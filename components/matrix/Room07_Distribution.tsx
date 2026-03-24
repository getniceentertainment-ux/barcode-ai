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

// 1. GET ROUTE: Required for Room 07 to poll the MDX Job Status
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    
    if (!jobId || jobId === 'undefined') {
      return NextResponse.json({ error: "Missing or invalid jobId" }, { status: 400 });
    }

    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
    // SURGICAL FIX: Strictly target the MDX endpoint
    const ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_MDX;

    const statusRes = await fetch(`https://api.runpod.ai/v2/${ENDPOINT_ID}/status/${jobId}`, {
      headers: { 'Authorization': `Bearer ${RUNPOD_API_KEY}` },
      cache: 'no-store'
    });
    
    return NextResponse.json(await statusRes.json());
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 2. POST ROUTE: Initiates the TikTok MDX Slice (Secured + Monetized)
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
      if (authError || !user) {
        return NextResponse.json({ error: "Security Exception: Forged or Expired Token." }, { status: 401 });
      }
      userId = user.id;
    }

    if (!userId) return NextResponse.json({ error: "User resolution failed" }, { status: 401 });

    const body = await req.json();
    const file_url = body.audioUrl;

    if (!file_url) return NextResponse.json({ error: "Missing audioUrl" }, { status: 400 });

    // --- STRICT CREDIT CHECK ---
    const { data: profile, error: dbError } = await supabaseAdmin
      .from('profiles')
      .select('credits, tier')
      .eq('id', userId)
      .single();

    if (dbError || !profile) return NextResponse.json({ error: "Security Exception: Identity not found." }, { status: 401 });

    if (!isB2B && profile.tier !== 'The Mogul' && profile.credits <= 0) {
      return NextResponse.json({ error: "Insufficient Generations." }, { status: 403 });
    }

    // --- RATE LIMITING ---
    const { success } = await ratelimit.limit(userId);
    if (!success) return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });

    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
    // SURGICAL FIX: Strictly target the MDX endpoint
    const ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_MDX;

    if (!RUNPOD_API_KEY || !ENDPOINT_ID) return NextResponse.json({ error: "Server missing MDX config." }, { status: 500 });

    // --- RUNPOD EXECUTION ---
    const runResponse = await fetch(`https://api.runpod.ai/v2/${ENDPOINT_ID}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RUNPOD_API_KEY}`
      },
      body: JSON.stringify({
        input: {
          // SURGICAL FIX: Tell the RunPod worker exactly what to do
          task_type: "extract_snippet", 
          file_url: file_url,
        }
      })
    });

    const data = await runResponse.json();

    // --- ACCOUNTING & BILLING ---
    if (data.id) {
      if (isB2B) {
        if (stripeSubscriptionItemId) {
          try {
            await stripe.subscriptionItems.createUsageRecord(stripeSubscriptionItemId, {
              quantity: 1, timestamp: Math.floor(Date.now() / 1000), action: 'increment'
            });
          } catch(e) { console.error("Stripe Metered Billing failed", e); }
        }
        await supabaseAdmin.rpc('increment_api_calls', { target_user_id: userId });
      } else if (profile.tier !== 'The Mogul') {
        await supabaseAdmin.from('profiles').update({ credits: profile.credits - 1 }).eq('id', userId);
      }
      
      return NextResponse.json({ jobId: data.id });
    } else {
      throw new Error(data.error || "MDX processing failed");
    }

  } catch (error: any) {
    console.error("MDX API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}