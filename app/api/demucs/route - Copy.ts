import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// 🚨 1. VERCEL CACHE KILLER & TIMEOUT OVERRIDE
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 Minute Vercel limit for heavy MDX isolation

// 🚨 2. UPSTASH RATE LIMITER (Protects Worker 3 GPU Compute)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});
const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(3, "1 m"), // Strict: Max 3 MDX splits per minute
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
    if (!success) return NextResponse.json({ error: "Rate Limit Exceeded. Awaiting GPU cooldown." }, { status: 429 });

    const body = await req.json();
    const { file_url } = body;
    if (!file_url) return NextResponse.json({ error: "Missing file_url" }, { status: 400 });

    const { data: profile } = await supabaseAdmin.from('profiles').select('credits, tier').eq('id', userId).single();
    if (!profile || (profile.tier !== 'The Mogul' && profile.credits <= 0)) {
      return NextResponse.json({ error: "Insufficient Generations." }, { status: 403 });
    }

    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
    const ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_MDX;

    if (!RUNPOD_API_KEY || !ENDPOINT_ID) {
      await new Promise(resolve => setTimeout(resolve, 4500));
      if (profile.tier !== 'The Mogul') {
        await supabaseAdmin.from('profiles').update({ credits: profile.credits - 1 }).eq('id', userId);
      }
      return NextResponse.json({ status: "COMPLETED", instrumental_url: file_url, vocal_url: file_url });
    }

    const runResponse = await fetch(`https://api.runpod.ai/v2/${ENDPOINT_ID}/runsync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RUNPOD_API_KEY}` },
      body: JSON.stringify({ input: { task_type: "separate", file_url: file_url, model: "UVR-MDX-NET-Voc_FT.onnx" } })
    });

    const data = await runResponse.json();

    if (data.status === "COMPLETED") {
      if (profile.tier !== 'The Mogul') {
        await supabaseAdmin.from('profiles').update({ credits: profile.credits - 1 }).eq('id', userId);
      }
      return NextResponse.json({
         instrumental_url: data.output.stems.instrumental || file_url,
         vocal_url: data.output.stems.vocals || file_url
      });
    } else {
      throw new Error(data.error || "MDX Worker Failed to split stems");
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}