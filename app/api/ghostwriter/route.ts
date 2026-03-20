import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16', // Use your current Stripe API version
});

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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });

    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
    const ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_TALON;

    const statusRes = await fetch(`https://api.runpod.ai/v2/${ENDPOINT_ID}/status/${jobId}`, {
      headers: { 'Authorization': `Bearer ${RUNPOD_API_KEY}` },
      cache: 'no-store' 
    });
    
    return NextResponse.json(await statusRes.json());
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: "Access Denied: Missing Token" }, { status: 401 });
    
    const token = authHeader.replace('Bearer ', '');
    
    let userId: string | null = null;
    let isB2B = false;
    let stripeSubscriptionItemId: string | null = null;

    // --- HYBRID AUTHENTICATION ROUTING ---
    if (token.startsWith('getnice_')) {
      // 1. B2B EXTERNAL API KEY FLOW
      isB2B = true;
      const { data: b2bProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, stripe_metered_item_id') // Ensure this column exists in DB for B2B users
        .eq('b2b_api_key', token)
        .single();

      if (!b2bProfile) return NextResponse.json({ error: "Access Denied: Invalid API Key" }, { status: 401 });
      
      userId = b2bProfile.id;
      stripeSubscriptionItemId = b2bProfile.stripe_metered_item_id;
      
    } else {
      // 2. STANDARD JWT BROWSER FLOW
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !user) return NextResponse.json({ error: "Access Denied: Invalid Auth Token" }, { status: 401 });
      userId = user.id;
    }

    // --- RATE LIMITING ---
    if (!userId) {
      return NextResponse.json({ error: "Access Denied: User ID resolution failed" }, { status: 401 });
    }
    
    const { success } = await ratelimit.limit(userId);
    if (!success) return NextResponse.json({ error: "Rate Limit Exceeded. Please hold." }, { status: 429 });

    const body = await req.json();
    const { prompt, title, bpm, key, stageName, tag, style, blueprint } = body;

    // --- CREDIT / AUTHORIZATION CHECK ---
    let profileTier = 'Free Loader';
    if (!isB2B) {
      const { data: profile } = await supabaseAdmin.from('profiles').select('credits, tier').eq('id', userId).single();
      if (!profile || (profile.tier !== 'The Mogul' && profile.credits <= 0)) {
        return NextResponse.json({ error: "Insufficient Generations." }, { status: 403 });
      }
      profileTier = profile.tier;
    }

    const thematicPrompt = title ? `SONG TITLE: "${title}". ${prompt}` : prompt;

    // --- RUNPOD EXECUTION ---
    const runResponse = await fetch(`https://api.runpod.ai/v2/${process.env.RUNPOD_ENDPOINT_TALON}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}` },
      body: JSON.stringify({
        input: {
          task_type: "generate",
          prompt: thematicPrompt,
          bpm: bpm || 120,
          key: key || "Unknown Key",            
          style: style || "getnice_hybrid",
          stageName: stageName || "The Artist", 
          blueprint: blueprint 
        }
      })
    });

    const runData = await runResponse.json();
    
    // --- ACCOUNTING & BILLING ---
    if (runData.id) {
      if (isB2B) {
        // B2B: Log API call to DB for the dashboard, and charge Stripe Metered Billing
        // IMPORTANT: In production, you might move this to the GET route (on 'COMPLETED' status) to only charge for successful generations, but this secures the request.
        if (stripeSubscriptionItemId) {
          try {
            await stripe.subscriptionItems.createUsageRecord(
              stripeSubscriptionItemId,
              { quantity: 1, timestamp: Math.floor(Date.now() / 1000), action: 'increment' }
            );
          } catch (stripeErr) {
            console.error("Stripe Metered Billing Failed:", stripeErr);
            // Non-blocking error, allow generation to proceed but log failure
          }
        }
        // Increment the dashboard counter
        await supabaseAdmin.rpc('increment_api_calls', { target_user_id: userId }); 

      } else if (profileTier !== 'The Mogul') {
        // B2C: Deduct 1 standard credit
        const { data: currentProfile } = await supabaseAdmin.from('profiles').select('credits').eq('id', userId).single();
        if (currentProfile) {
          await supabaseAdmin.from('profiles').update({ credits: currentProfile.credits - 1 }).eq('id', userId);
        }
      }
      
      return NextResponse.json({ jobId: runData.id });
    } else {
      throw new Error(runData.error || "Failed to initialize TALON container.");
    }

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}