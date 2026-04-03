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

    if (!userId) {
      return NextResponse.json({ error: "Access Denied: User ID resolution failed" }, { status: 401 });
    }
    
    const { success } = await ratelimit.limit(userId);
    if (!success) return NextResponse.json({ error: "Rate Limit Exceeded. Please hold." }, { status: 429 });

    const body = await req.json();
    
    const { 
      prompt, title, bpm, key, stageName, tag, style, blueprint, 
      motive, struggle, hustle, useSlang, useIntel, flowReference,
      systemConstraint, pocket // --- NEW POCKET EXTRACTION ---
    } = body;

    let profileTier = 'Free Loader';
    let cost = 1;
    
    if (blueprint && Array.isArray(blueprint)) {
      cost = Math.max(1, Math.ceil(blueprint.length / 2));
    }

    if (!isB2B) {
      const { data: profile } = await supabaseAdmin.from('profiles').select('credits, tier').eq('id', userId).single();
      
      if (!profile || (profile.tier !== 'The Mogul' && profile.credits < cost)) {
        return NextResponse.json({ error: `Insufficient Generations. This structure requires ${cost} CRD.` }, { status: 403 });
      }
      profileTier = profile.tier;
    }

    // --- SURGICAL PIVOT: EMPIRICAL FLOW MATHEMATICS ---
    // Map physical syllables-per-second (SPS) limits based on Billboard hit data (4.5 median)
    let ttsSpeedLimit = 4.5; // Billboard hit baseline

    switch (style) {
      case "chopper":
        ttsSpeedLimit = 6.0; // The absolute redline for AI TTS. Simulates rapid 16th/32nd notes.
        break;
      case "triplet":
        ttsSpeedLimit = 5.0; // 8th note triplets mapped to standard Trap BPMs.
        break;
      case "getnice_hybrid":
        ttsSpeedLimit = 4.5; // Signature versatile pocket. Matches the academic hitmaker median.
        break;
      case "heartbeat": 
        ttsSpeedLimit = 4.0; // Boom-bap. Laid back, behind the pocket, swinging 8ths.
        break;
      case "lazy":
        ttsSpeedLimit = 3.0; // Wavy, drawn out, forces massive gaps and breathing room.
        break;
    }

    const activeBpm = bpm || 120;
    const secondsPerBar = (60 / activeBpm) * 4;
    const timePerLine = secondsPerBar * 2; // Engine maps 2 bars per line by default
    const maxSyllables = Math.floor(timePerLine * ttsSpeedLimit);

    // --- POCKET PLACEMENT INJECTION ---
    let pocketInstruction = "FORMATTING: End every line with a period (.) to signify a standard hard stop exactly on the beat.";
    if (pocket === "chainlink") {
      pocketInstruction = "SYNCOPATION OVERRIDE (CHAIN-LINK): Do not wait for the end of the bar to rhyme. Bleed across the bar lines. You MUST end lines with a comma (,) to signal no breath, spilling directly into the next bar.";
    } else if (pocket === "pickup") {
      pocketInstruction = "SYNCOPATION OVERRIDE (THE DRAG/PICKUP): Start your phrases late or early. You MUST start lines with an ellipsis (...) to signal a delay or pickup note off the 1-count.";
    }

    const getNiceOverride = `
    CRITICAL OVERRIDE - THE "GETNICE" DIRECTIVE:
    1. NO SANITIZED POETRY: Do not write cheesy, generic, or polite poetry.
    2. RAW AUTHENTICITY: Write gritty, street-level bars. Use internal rhymes, complex syllables, and raw emotional imagery. Spit hot fire.
    3. ENERGY FORMATTING: Output the actual lyrics in ALL CAPS to simulate an aggressive, high-energy vocal delivery.
    4. STRUCTURAL ARCHITECTURE: Write EXACTLY the requested number of lines. Do NOT write timestamps, bar counts, or metadata. Just the lyrics.
    5. THE INSTRUMENTAL METRONOME: If the blueprint specifies an "INSTRUMENTAL" block, DO NOT write lyrics for it. Instead, output the header [Instrumental] followed by the exact word "Mmm." repeated once for every bar of that section.
    6. THE DYNAMIC SYLLABLE CAP: You are writing for an AI Voice Engine. To match the exact physical cadence of the requested flow style, EVERY single line you write MUST be exactly ${maxSyllables} syllables or less. Count your syllables carefully. Do not exceed this limit or the audio pipeline will fail.
    7. POCKET PLACEMENT: ${pocketInstruction}
    8. THE BEAT 4 ANCHOR: Structure the syntax so the primary rhyming syllable inherently falls at the end of the phrase (simulating Beat 4 of the measure).
    9. THE 25% STRESS RATIO: Do not over-rhyme. Only about 25% of stressed syllables should rhyme. Use internal rhymes sparingly to maintain authentic street flow and avoid sounding like a nursery rhyme.
    `;

    const thematicPrompt = `SONG TITLE: "${title || 'UNTITLED'}".
    USER PROMPT: ${prompt}
    THE MOTIVE (Drive): ${motive || "Mastering the craft"}
    THE STRUGGLE (Setback): ${struggle || "Against the odds"}
    THE HUSTLE (Execution): ${hustle || "Relentless execution"}

    ${getNiceOverride}
    
    ${systemConstraint || ''}`; 

    const forcedStyle = style ? `${style} (GetNice Hybrid Blueprint)` : "getnice_hybrid";

    const runResponse = await fetch(`https://api.runpod.ai/v2/${process.env.RUNPOD_ENDPOINT_TALON}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}` },
      body: JSON.stringify({
        input: {
          task_type: "generate",
          prompt: thematicPrompt,
          flowReference: flowReference,
          motive: motive || "Mastering the craft",
          struggle: struggle || "Against the odds",
          hustle: hustle || "Relentless execution",
          bpm: activeBpm,
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