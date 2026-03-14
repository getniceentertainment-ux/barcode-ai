import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const dynamic = 'force-dynamic';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// Stricter rate limit for micro-refinements to prevent abuse
const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"), 
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: "Access Denied: Missing JWT" }, { status: 401 });
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Access Denied: Invalid Auth Token" }, { status: 401 });

    const { success } = await ratelimit.limit(`refine_${user.id}`);
    if (!success) return NextResponse.json({ error: "Rate Limit Exceeded. Please slow down edits." }, { status: 429 });

    const body = await req.json();
    const { originalLine, instruction, style } = body;

    if (!originalLine || !instruction) {
      return NextResponse.json({ error: "Missing line or instruction." }, { status: 400 });
    }

    // FIXED: Formatted the payload to strictly match the new handler.py schema
    const runResponse = await fetch(`https://api.runpod.ai/v2/${process.env.RUNPOD_ENDPOINT_TALON}/runsync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}` },
      body: JSON.stringify({
        input: {
          task_type: "refine",
          originalLine: originalLine,
          instruction: instruction
        }
      })
    });

    const runData = await runResponse.json();
    
    // FIXED: The new handler.py returns {"refinedLine": "..."} instead of {"lyrics": "..."}
    if (runData.output && runData.output.refinedLine) {
      return NextResponse.json({ refinedLine: runData.output.refinedLine });
    } else {
      throw new Error(runData.error || "TALON Failed to refine line.");
    }

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}