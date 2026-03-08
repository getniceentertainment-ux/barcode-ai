import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Initialize Upstash Redis for Rate Limiting (5 requests per minute)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(5, "1 m"), 
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // 1. JWT SERVER-SIDE VERIFICATION
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: "Access Denied: Missing JWT" }, { status: 401 });
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: "Access Denied: Invalid Auth Token" }, { status: 401 });
    }

    // 2. UPSTASH RATE LIMITING
    const { success } = await ratelimit.limit(user.id);
    if (!success) {
      return NextResponse.json({ error: "Rate Limit Exceeded. Please hold." }, { status: 429 });
    }

    const body = await req.json();
    const { prompt, title, bpm, tag, style, gender, useSlang, useIntel, blueprint } = body;

    // 3. CHECK LEDGER CREDITS
    const { data: profile, error: dbError } = await supabaseAdmin
      .from('profiles')
      .select('credits, tier')
      .eq('id', user.id)
      .single();

    if (dbError || !profile) return NextResponse.json({ error: "Identity not found in Ledger." }, { status: 401 });
    if (profile.tier !== 'The Mogul' && profile.credits <= 0) {
      return NextResponse.json({ error: "Insufficient Generations. Upgrade tier." }, { status: 403 });
    }

    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
    const ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_TALON;

    const thematicPrompt = title ? `SONG TITLE: "${title}". ${prompt}` : prompt;

    // 4. ASYNCHRONOUS RUNPOD DEPLOYMENT (Using /run to prevent 504 Timeouts)
    const runResponse = await fetch(`https://api.runpod.ai/v2/${ENDPOINT_ID}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RUNPOD_API_KEY}` },
      body: JSON.stringify({
        input: {
          task_type: "generate",
          prompt: thematicPrompt,
          tag: tag || "Standard",
          style: style || "getnice_hybrid",
          useSlang: useSlang,
          useIntel: useIntel,
          blueprint: blueprint
        }
      })
    });

    const runData = await runResponse.json();
    
    if (runData.id) {
      // 5. DEDUCT CREDIT (Only charge if successfully queued)
      if (profile.tier !== 'The Mogul') {
        await supabaseAdmin.from('profiles').update({ credits: profile.credits - 1 }).eq('id', user.id);
      }
      return NextResponse.json({ jobId: runData.id });
    } else {
      throw new Error(runData.error || "Failed to initialize TALON container.");
    }

  } catch (error: any) {
    console.error("API Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}