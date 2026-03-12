import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// 🚨 1. VERCEL CACHE KILLER & TIMEOUT OVERRIDE
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Allows Vercel to wait up to 5 minutes (Requires Vercel Pro)

// 🚨 2. UPSTASH RATE LIMITER (Protects Worker 2 Compute)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});
const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"), // Max 10 DSP scans per minute per user
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Security Exception: Missing Auth Token." }, { status: 401 });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Security Exception: Invalid Token." }, { status: 401 });

    const userId = user.id;

    // Rate Limit Check
    const { success } = await ratelimit.limit(userId);
    if (!success) return NextResponse.json({ error: "Rate Limit Exceeded. Cooling down matrix." }, { status: 429 });

    const body = await req.json();
    const { file_url } = body;
    if (!file_url) return NextResponse.json({ error: "Missing file_url" }, { status: 400 });

    const { data: profile } = await supabaseAdmin.from('profiles').select('credits, tier').eq('id', userId).single();
    if (!profile || (profile.tier !== 'The Mogul' && profile.credits <= 0)) {
      return NextResponse.json({ error: "Insufficient Generations." }, { status: 403 });
    }

    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
    const ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_DSP;

    const response = await fetch(`https://api.runpod.ai/v2/${ENDPOINT_ID}/runsync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RUNPOD_API_KEY}` },
      body: JSON.stringify({ input: { task_type: "analyze", file_url: file_url } })
    });

    const data = await response.json();

    if (data.status === "COMPLETED") {
      if (profile.tier !== 'The Mogul') {
        await supabaseAdmin.from('profiles').update({ credits: profile.credits - 1 }).eq('id', userId);
      }
      return NextResponse.json(data.output);
    } else {
      throw new Error(data.error || "DSP processing failed");
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}