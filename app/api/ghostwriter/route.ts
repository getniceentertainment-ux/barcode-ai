import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"), 
});

// 1. GET ROUTE: Required for Room 03 to poll the TALON Job Status
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    // Prevent polling if the ID is missing
    if (!jobId || jobId === 'undefined') {
      return NextResponse.json({ error: "Missing or invalid jobId" }, { status: 400 });
    }

    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
    const ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_TALON || process.env.RUNPOD_ENDPOINT_ID;

    const statusRes = await fetch(`https://api.runpod.ai/v2/${ENDPOINT_ID}/status/${jobId}`, {
      headers: { 'Authorization': `Bearer ${RUNPOD_API_KEY}` },
      cache: 'no-store'
    });
    
    return NextResponse.json(await statusRes.json());
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 2. POST ROUTE: Initiates the TALON Ghostwriter & Deducts Dynamic Credits
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Security Exception: Missing or invalid Auth Token." }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    let userId: string | null = null;
    let isB2B = false;
    let stripeSubscriptionItemId: string | null = null;

    // --- HYBRID AUTHENTICATION ---
    if (token.startsWith('getnice_')) {
      isB2B = true;
      const { data: b2bProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, stripe_metered_item_id')
        .eq('b2b_api_key', token)
        .single();

      if (!b2bProfile) return NextResponse.json({ error: "Invalid API Key" }, { status: 401 });
      userId = b2bProfile.id;
      stripeSubscriptionItemId = b2bProfile.stripe_metered_item_id;
    } else {
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !user) return NextResponse.json({ error: "Security Exception: Forged or Expired Token." }, { status: 401 });
      userId = user.id;
    }

    if (!userId) return NextResponse.json({ error: "User resolution failed" }, { status: 401 });

    const body = await req.json();
    
    // Ghostwriter payload parameters (No file_url expected)
    const { prompt, title, bpm, key, stageName, tag, style, gender, useSlang, useIntel, blueprint } = body;

    // --- DYNAMIC CREDIT CHECK ---
    let cost = 1;
    if (blueprint && Array.isArray(blueprint)) {
      // 1 Credit for every 2 structural blocks
      cost = Math.max(1, Math.ceil(blueprint.length / 2));
    }

    const { data: profile, error: dbError } = await supabaseAdmin
      .from('profiles')
      .select('credits, tier')
      .eq('id', userId)
      .single();

    if (dbError || !profile) return NextResponse.json({ error: "Security Exception: Identity not found." }, { status: 401 });

    if (!isB2B && profile.tier !== 'The Mogul' && profile.credits < cost) {
      return NextResponse.json({ error: `Insufficient Credits. Need ${cost} CRD.` }, { status: 403 });
    }

    // --- RATE LIMITING ---
    const { success } = await ratelimit.limit(userId);
    if (!success) return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });

    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
    const ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_TALON || process.env.RUNPOD_ENDPOINT_ID;

    if (!RUNPOD_API_KEY || !ENDPOINT_ID) return NextResponse.json({ error: "Server missing TALON config." }, { status: 500 });

    // --- PING RUNPOD TALON ENGINE ---
    const runResponse = await fetch(`https://api.runpod.ai/v2/${ENDPOINT_ID}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RUNPOD_API_KEY}`
      },
      body: JSON.stringify({
        input: {
          task_type: "generate_lyrics",
          prompt,
          title,
          bpm,
          key,
          stageName,
          tag,
          style,
          gender,
          useSlang,
          useIntel,
          blueprint
        }
      })
    });

    const data = await runResponse.json();

    if (data.id) {
      // --- ACCOUNTING & DEDUCTION ---
      if (isB2B) {
        if (stripeSubscriptionItemId) {
          try { await stripe.subscriptionItems.createUsageRecord(stripeSubscriptionItemId, { quantity: 1, timestamp: Math.floor(Date.now() / 1000), action: 'increment' }); } catch(e) {}
        }
        await supabaseAdmin.rpc('increment_api_calls', { target_user_id: userId });
      } else if (profile.tier !== 'The Mogul') {
        // Deduct the dynamic blueprint cost
        await supabaseAdmin.from('profiles').update({ credits: profile.credits - cost }).eq('id', userId);
      }
      return NextResponse.json({ jobId: data.id });
    } else {
      throw new Error(data.error || "TALON processing failed");
    }

  } catch (error: any) {
    console.error("Ghostwriter API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}