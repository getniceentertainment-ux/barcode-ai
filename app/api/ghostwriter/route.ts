import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16', 
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
      isB2B = true;
      const { data: b2bProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, stripe_metered_item_id') 
        .eq('b2b_api_key', token)
        .single();

      if (!b2bProfile) return NextResponse.json({ error: "Access Denied: Invalid API Key" }, { status: 401 });
      
      userId = b2bProfile.id;
      stripeSubscriptionItemId = b2bProfile.stripe_metered_item_id;
      
    } else {
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
    // NEW: Extracted the new parameters sent from Room 03
    const { 
      prompt, title, bpm, key, stageName, tag, style, blueprint, 
      motive, struggle, hustle, useSlang, useIntel 
    } = body;

    // --- DYNAMIC CREDIT COST CALCULATION ---
    let profileTier = 'Free Loader';
    let cost = 1;
    
    if (blueprint && Array.isArray(blueprint)) {
      cost = Math.max(1, Math.ceil(blueprint.length / 2));
    }

    // --- CREDIT / AUTHORIZATION CHECK ---
    if (!isB2B) {
      const { data: profile } = await supabaseAdmin.from('profiles').select('credits, tier').eq('id', userId).single();
      
      if (!profile || (profile.tier !== 'The Mogul' && profile.credits < cost)) {
        return NextResponse.json({ error: `Insufficient Generations. This structure requires ${cost} CRD.` }, { status: 403 });
      }
      profileTier = profile.tier;
    }

    // --- SURGICAL FIX: THE GETNICE OVERRIDE ---
    const getNiceOverride = `
    CRITICAL OVERRIDE - THE "GETNICE" DIRECTIVE:
    1. NO SANITIZED POETRY: Do not write cheesy, generic, or polite poetry.
    2. RAW AUTHENTICITY: Write gritty, street-level bars. Use internal rhymes, complex syllables, and raw emotional imagery. Spit hot fire.
    3. ENERGY FORMATTING: Output the actual lyrics in ALL CAPS to simulate an aggressive, high-energy vocal delivery.
    4. STRUCTURAL ARCHITECTURE: Rigidly structure the output with timestamps and exact bar counts.
    `;

    // NEW: Injected Motive, Struggle, and Hustle directly into the prompt context
    const thematicPrompt = `SONG TITLE: "${title || 'UNTITLED'}".
    USER PROMPT: ${prompt}
    THE MOTIVE (Drive): ${motive || "Mastering the craft"}
    THE STRUGGLE (Setback): ${struggle || "Against the odds"}
    THE HUSTLE (Execution): ${hustle || "Relentless execution"}

    ${getNiceOverride}`;

    // Force the LoRA to trigger by secretly appending our custom style string
    const forcedStyle = style ? `${style} (GetNice Hybrid Blueprint)` : "getnice_hybrid";

    // --- RUNPOD EXECUTION ---
    const runResponse = await fetch(`https://api.runpod.ai/v2/${process.env.RUNPOD_ENDPOINT_TALON}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}` },
      body: JSON.stringify({
        input: {
          task_type: "generate",
          prompt: thematicPrompt,
	  flowReference: flowReference, // <-- NEW: Hand it to the Python worker
          // NEW: Passing parameters explicitly to the worker
          motive: motive || "Mastering the craft",
          struggle: struggle || "Against the odds",
          hustle: hustle || "Relentless execution",
          bpm: bpm || 120,
          key: key || "Unknown Key",            
          style: forcedStyle, 
          stageName: stageName || "The Artist", 
          tag: tag,
          useSlang: useSlang,
          useIntel: useIntel,
          blueprint: blueprint 
        }
      })
    });

    const runData = await runResponse.json();
    
    // --- ACCOUNTING & BILLING ---
    if (runData.id) {
      if (isB2B) {
        if (stripeSubscriptionItemId) {
          try {
            await stripe.subscriptionItems.createUsageRecord(
              stripeSubscriptionItemId,
              { quantity: 1, timestamp: Math.floor(Date.now() / 1000), action: 'increment' }
            );
          } catch (stripeErr) {
            console.error("Stripe Metered Billing Failed:", stripeErr);
          }
        }
        await supabaseAdmin.rpc('increment_api_calls', { target_user_id: userId }); 

      } else if (profileTier !== 'The Mogul') {
        const { data: currentProfile } = await supabaseAdmin.from('profiles').select('credits').eq('id', userId).single();
        if (currentProfile) {
          await supabaseAdmin.from('profiles').update({ credits: currentProfile.credits - cost }).eq('id', userId);
          
          // NEW: Log the deduction to the Audit Ledger for Room 08 visibility
          await supabaseAdmin.from('transactions').insert({
            user_id: userId,
            amount: -cost,
            type: 'GENERATION',
            description: `Ghostwriter: Synthesized ${blueprint?.length || 0} Blocks`
          });
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