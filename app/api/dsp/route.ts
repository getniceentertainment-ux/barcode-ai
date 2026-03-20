import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// Initialize Admin Client
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

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const token = authHeader.replace('Bearer ', '');
    
    let userId: string | null = null;
    let isB2B = false;
    let stripeSubscriptionItemId: string | null = null;

    // --- HYBRID AUTHENTICATION (Matching Ghostwriter) ---
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
      if (authError || !user) return NextResponse.json({ error: "Invalid Session" }, { status: 401 });
      userId = user.id;
    }

    if (!userId) return NextResponse.json({ error: "User resolution failed" }, { status: 401 });

    // --- STRICT CREDIT CHECK ---
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('credits, tier')
      .eq('id', userId)
      .single();

    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    // Block if out of credits (unless Mogul or B2B)
    if (!isB2B && profile.tier !== 'The Mogul' && (profile.credits === null || profile.credits <= 0)) {
      return NextResponse.json({ error: "Insufficient credits for Brain Train." }, { status: 403 });
    }

    // Rate limiting
    const { success } = await ratelimit.limit(userId);
    if (!success) return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });

    const body = await req.json();
    const { audioUrl, task = "analyze_dsp", blueprint_vibe } = body;

    // --- DYNAMIC RUNPOD ROUTING ---
    // If it's a "vibe train" (not just DSP), it might use the TALON endpoint
    const endpointId = task === "analyze_vibe" ? process.env.RUNPOD_ENDPOINT_TALON : process.env.RUNPOD_ENDPOINT_DSP;

    const runResponse = await fetch(`https://api.runpod.ai/v2/${endpointId}/run`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}` 
      },
      body: JSON.stringify({
        input: {
          task: task,
          audio_url: audioUrl,
          blueprint_vibe: blueprint_vibe
        }
      })
    });

    const runData = await runResponse.json();

    // --- ACCOUNTING ---
    if (runData.id) {
      if (isB2B) {
        if (stripeSubscriptionItemId) {
          await stripe.subscriptionItems.createUsageRecord(stripeSubscriptionItemId, {
            quantity: 1, timestamp: Math.floor(Date.now() / 1000), action: 'increment'
          });
        }
        await supabaseAdmin.rpc('increment_api_calls', { target_user_id: userId });
      } else if (profile.tier !== 'The Mogul') {
        // Deduct 1 credit for Brain Train / DSP analysis
        await supabaseAdmin
          .from('profiles')
          .update({ credits: profile.credits - 1 })
          .eq('id', userId);
      }
      
      return NextResponse.json({ jobId: runData.id });
    }

    throw new Error(runData.error || "RunPod initiation failed.");

  } catch (error: any) {
    console.error("Brain Train API Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}