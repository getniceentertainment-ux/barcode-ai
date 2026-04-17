import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });
const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL || '', token: process.env.UPSTASH_REDIS_REST_TOKEN || '' });
const ratelimit = new Ratelimit({ redis: redis, limiter: Ratelimit.slidingWindow(5, "1 m") });
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// --- THE DYNAMIC ASSASSIN DICTIONARY (FRONTEND CONTROLLED) ---
// Update this list anytime. Next.js will pass it to the Python worker on every request.
const BANNED_WORDS_MAP = {
  "\\bconcrete jungle\\b": "the pavement",
  "\\bjiggy\\b": "active",
  "\\bphat\\b": "heavy",
  "\\bcheddar\\b": "capital",
  "\\brags to riches\\b": "mud to margins",
  "\\bno pain no gain\\b": "sweat equity",
  "\\bweathered storms?\\b": "took the hits",
  "\\bnaysayers?\\b": "detractors",
  "\\bdarkest hour\\b": "bottom line",
  "\\bspirits? took flight\\b": "numbers went up",
  "\\bdreams? dare to breathe\\b": "vision stays clear",
  "\\brise from our knees\\b": "stand on business",
  "\\btime'?s arrow\\b": "the clock",
  "\\bchatter\\b": "static",
  "\\btapestr(?:y|ies)\\b": "blueprint",
  "\\bdelve[sd]?\\b": "dig",
  "\\btestaments?\\b": "proof",
  "\\bbeacons?\\b": "target",
  "\\bjourneys?\\b": "process",
  "\\bmyriad\\b": "hundred",
  "\\blandscapes?\\b": "market",
  "\\bnavigat(?:e|ed|ing|es)\\b": "maneuver",
  "\\bresonat(?:e|ed|ing|es)\\b": "connect",
  "\\bfoster(?:s|ed|ing)?\\b": "build",
  "\\bcatalysts?\\b": "spark",
  "\\bparadigms?\\b": "model",
  "\\bsynerg(?:y|ies)\\b": "leverage",
  "\\bunleash(?:es|ed|ing)?\\b": "deploy",
  "\\bplights?\\b": "risk",
  "\\bfrights?\\b": "panic",
  "\\bignit(?:e|es|ed|ing)\\b": "spark",
  "\\bdivine\\b": "exact",
  "\\bsublime\\b": "top tier",
  "\\bmindstreams?\\b": "focus",
  "\\bwhispers?\\b": "talk",
  "\\bshadows?\\b": "blindspots",
  "\\bdancing\\b": "moving",
  "\\bembrac(?:e|es|ed|ing)\\b": "lock in",
  "\\bsouls?\\b": "heads",
  "\\babyss(?:es)?\\b": "the red",
  "\\bvoids?\\b": "the red",
  "\\bchaos\\b": "static",
  "\\bdestin(?:y|ies)\\b": "outcome",
  "\\bfates?\\b": "odds",
  "\\btears\\b": "losses",
  "\\bsorrows?\\b": "stress",
  "\\bmelod(?:y|ies)\\b": "rhythm",
  "\\bsymphon(?:y|ies)\\b": "system",
  "\\bashes\\b": "dust",
  "\\bstrife\\b": "pressure",
  "\\byearning\\b": "starving",
  "\\bkingdoms?\\b": "boardroom",
  "\\bthrones?\\b": "desk",
  "\\bcrowns?\\b": "equity",
  "\\brealms?\\b": "zone",
  "\\blegac(?:y|ies)\\b": "portfolio",
  "\\bquests?\\b": "hustle",
  "\\bvanquish(?:es|ed|ing)?\\b": "clear",
  "\\bfortress(?:es)?\\b": "compound",
  "\\bprophec(?:y|ies)\\b": "forecast",
  "\\bomens?\\b": "signal",
  "\\bcrusades?\\b": "campaign",
  "\\bvanguards?\\b": "frontline",
  "\\bsovereigns?\\b": "owner",
  "\\bdominions?\\b": "territory",
  "\\bforsaken\\b": "cut off",
  "\\bweav(?:e|es|ed|ing)\\b": "build",
  "\\bforg(?:e|es|ed|ing)\\b": "build",
  "\\bcraft(?:s|ed|ing)?\\b": "build",
  "\\bsculpt(?:s|ed|ing)?\\b": "mold",
  "\\bflutter(?:s|ed|ing)?\\b": "shake",
  "\\bplung(?:e|es|ed|ing)\\b": "drop",
  "\\bunfurl(?:s|ed|ing)?\\b": "open",
  "\\bawaken(?:s|ed|ing)?\\b": "wake",
  "\\bslumber(?:s|ed|ing)?\\b": "sleep",
  "\\bbeckon(?:s|ed|ing)?\\b": "call",
  "\\bentwin(?:e|es|ed|ing)\\b": "lock",
  "\\benchant(?:s|ed|ing)?\\b": "hook",
  "\\bcaptivat(?:e|es|ed|ing)\\b": "trap",
  "\\billuminat(?:e|es|ed|ing)\\b": "expose",
  "\\btranscend(?:s|ed|ing)?\\b": "scale",
  "\\blucre\\b": "funds",
  "\\bserene\\b": "calm",
  "\\buncoil(?:s|ed|ing)?\\b": "move",
  "\\bveins\\b": "lines",
  "\\bstains\\b": "marks",
  "\\bplains\\b": "blocks",
  "\\brefrains\\b": "hooks",
  "\\bgleam(?:s|ed|ing)?\\b": "shine",
  "\\bbeams?\\b": "lights",
  "\\bclimb(?:s|ed|ing)?\\b": "scale",
  "\\bmachines?\\b": "engine",
  "\\bvisages?\\b": "face",
  "\\bclandestine\\b": "off-books",
  "\\bsupreme\\b": "top",
  "\\bschemes?\\b": "play",
  "\\bspoils?\\b": "profits"
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });

    const statusRes = await fetch(`https://api.runpod.ai/v2/${process.env.RUNPOD_ENDPOINT_TALON}/status/${jobId}`, {
      headers: { 'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}` }, cache: 'no-store' 
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
      const { data: b2bProfile } = await supabaseAdmin.from('profiles').select('id, stripe_metered_item_id').eq('b2b_api_key', token).single();
      if (!b2bProfile) return NextResponse.json({ error: "Access Denied: Invalid API Key" }, { status: 401 });
      userId = b2bProfile.id; stripeSubscriptionItemId = b2bProfile.stripe_metered_item_id;
    } else {
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !user) return NextResponse.json({ error: "Access Denied: Invalid Auth Token" }, { status: 401 });
      userId = user.id;
    }

    if (!userId) return NextResponse.json({ error: "Access Denied: User ID resolution failed" }, { status: 401 });
    
    const { success } = await ratelimit.limit(userId);
    if (!success) return NextResponse.json({ error: "Rate Limit Exceeded. Please hold." }, { status: 429 });

    const body = await req.json();
    const { prompt, title, bpm, key, stageName, tag, style, blueprint, motive, struggle, hustle, useSlang, useIntel, flowReference, systemConstraint, pocket, strikeZone, hookType, flowEvolution, dynamic_array, contour } = body;

    let profileTier = 'Free Loader';
    let cost = 1;
    if (blueprint && Array.isArray(blueprint)) cost = Math.max(1, Math.ceil(blueprint.length / 2));

    if (!isB2B) {
      const { data: profile } = await supabaseAdmin.from('profiles').select('credits, tier').eq('id', userId).single();
      if (!profile || (profile.tier !== 'The Mogul' && profile.credits < cost)) {
        return NextResponse.json({ error: `Insufficient Generations. This structure requires ${cost} CRD.` }, { status: 403 });
      }
      profileTier = profile.tier;
    }

    // --- EMPIRICAL SYNCOPATION LIMITS ---
    let ttsSpeedLimit = 4.5; 
    switch (style) {
      case "chopper": ttsSpeedLimit = 6.0; break;
      case "triplet": ttsSpeedLimit = 5.0; break;
      case "getnice_hybrid": ttsSpeedLimit = 4.5; break;
      case "heartbeat": ttsSpeedLimit = 4.0; break;
      case "lazy": ttsSpeedLimit = 3.0; break;
    }

    const activeBpm = bpm || 120;
    const secondsPerBar = (60 / activeBpm) * 4;
    const timePerLine = secondsPerBar; 
    const maxSyllables = Math.max(6, Math.floor(timePerLine * ttsSpeedLimit));

    let pocketInstruction = "FORMATTING: End every line with a period (.) to signify a standard hard stop exactly on the beat.";
    if (pocket === "chainlink") {
      pocketInstruction = "SYNCOPATION OVERRIDE (CHAIN-LINK): Do not wait for the end of the bar to rhyme. Bleed across the bar lines. You MUST end lines with a comma (,) to signal no breath, spilling directly into the next bar.";
    } else if (pocket === "pickup") {
      pocketInstruction = "SYNCOPATION OVERRIDE (THE DRAG/PICKUP): Start your phrases late or early. You MUST start lines with an ellipsis (...) to signal a delay or pickup note off the 1-count.";
    }

    // --- DSP VOCAL ARTICULATION ---
    let dspVocalInstruction = "";
    const isMinor = (key || "").toLowerCase().includes('m');
    const isFast = activeBpm > 135;

    if (isMinor && isFast) dspVocalInstruction = `DSP MATCH: MINOR KEY, FAST TEMPO. Inject aggressive, rapid-fire stutters (e.g., "g-g-g-get it", "m-m-move") and sharp, dark vocal drops.`;
    else if (isMinor && !isFast) dspVocalInstruction = `DSP MATCH: MINOR KEY, SLOW TEMPO. Inject heavy, isolated 1-word pauses (e.g., "WAIT, ...") and dragged-out sinister spelling (e.g., "R-I-P").`;
    else if (!isMinor && isFast) dspVocalInstruction = `DSP MATCH: MAJOR KEY, FAST TEMPO. Inject high-energy repeated chants (e.g., "go go go go") and triumphant rhythmic bouncing.`;
    else dspVocalInstruction = `DSP MATCH: MAJOR KEY, SLOW TEMPO. Inject massive, anthemic spelled-out words (e.g., "T to the A") and huge group-style pauses.`;

    const getNiceOverride = `
    CRITICAL OVERRIDE - THE "GETNICE" DIRECTIVE:
    1. NO SANITIZED POETRY: Do not write cheesy, generic, or polite poetry.
    2. RAW AUTHENTICITY: Write gritty, street-level bars. Use internal rhymes, complex syllables, and raw emotional imagery. Spit hot fire.
    3. ENERGY FORMATTING: Output the actual lyrics in ALL CAPS to simulate an aggressive, high-energy vocal delivery.
    4. STRUCTURAL ARCHITECTURE: Write EXACTLY the requested number of lines. Do NOT write timestamps, bar counts, or metadata. Just the lyrics.
    6. THE DYNAMIC SYLLABLE CAP: You are writing for an AI Voice Engine. To match the exact physical cadence of the requested flow style, EVERY single line you write MUST be exactly ${maxSyllables} syllables or less. Count your syllables carefully. Do not exceed this limit or the audio pipeline will fail.
    7. POCKET PLACEMENT: ${pocketInstruction}
    8. THE BEAT 4 ANCHOR: Structure the syntax so the primary rhyming syllable inherently falls at the end of the phrase (simulating Beat 4 of the measure).
    9. THE 25% STRESS RATIO: Do not over-rhyme. Only about 25% of stressed syllables should rhyme. Use internal rhymes sparingly to maintain authentic street flow and avoid sounding like a nursery rhyme.
    10. DYNAMIC ARTICULATION (THE HUMAN ELEMENT): Break the robotic grid occasionally. Based on the instrumental's DSP analysis, you MUST inject structural anomalies:
        - Rhythmic stutters on consonants (e.g., "g-g-go", "b-b-bag").
        - Spelled-out words or acronyms for bounce (e.g., "T to the A", "S-T-A-R").
        - Isolated 1-word chants followed by commas to simulate vocal drops/pauses (e.g., "WAIT, I took the...", "YEAH, we running...").
        - ${dspVocalInstruction}
    11. BREATH CONTROL: Use the pipe symbol (|) to insert rhythmic pauses. One pipe equals one rhythmic step of silence on the 16-slot grid. Use this to create a "Texas Drawl" or heavy syncopation.

    `;

    const thematicPrompt = `SONG TITLE: "${title || 'UNTITLED'}".\nUSER PROMPT: ${prompt}\nTHE MOTIVE (Drive): ${motive || "Mastering the craft"}\nTHE STRUGGLE (Setback): ${struggle || "Against the odds"}\nTHE HUSTLE (Execution): ${hustle || "Relentless execution"}\n${getNiceOverride}\n${systemConstraint || ''}`; 
    const forcedStyle = style ? `${style} (GetNice Hybrid Blueprint)` : "getnice_hybrid";

    const runResponse = await fetch(`https://api.runpod.ai/v2/${process.env.RUNPOD_ENDPOINT_TALON}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}` },
      body: JSON.stringify({
        input: {
          task_type: "generate", 
          prompt: thematicPrompt, 
          flowReference: flowReference,
          motive: motive, 
          struggle: struggle, 
          hustle: hustle, 
          bpm: activeBpm, 
          key: key || "Unknown Key",            
          style: forcedStyle, 
          stageName: stageName || "The Artist", 
          tag: tag, 
          useSlang: useSlang, 
          useIntel: useIntel, 
          blueprint: blueprint,
          pocket: pocket,
          strikeZone: strikeZone,
          hookType: hookType,
          flowEvolution: flowEvolution,
          dynamic_array: dynamic_array, // <-- ADDED
          contour: contour,             // <-- ADDED
          bannedWordsMap: BANNED_WORDS_MAP
        }
      })
    });

    const runData = await runResponse.json();
    
    if (runData.id) {
      if (isB2B) {
        if (stripeSubscriptionItemId) {
          try { await stripe.subscriptionItems.createUsageRecord(stripeSubscriptionItemId, { quantity: 1, timestamp: Math.floor(Date.now() / 1000), action: 'increment' }); } catch (stripeErr) {}
        }
        await supabaseAdmin.rpc('increment_api_calls', { target_user_id: userId }); 
      } else if (profileTier !== 'The Mogul') {
        const { data: currentProfile } = await supabaseAdmin.from('profiles').select('credits').eq('id', userId).single();
        if (currentProfile) {
          await supabaseAdmin.from('profiles').update({ credits: currentProfile.credits - cost }).eq('id', userId);
          await supabaseAdmin.from('transactions').insert({ user_id: userId, amount: -cost, type: 'GENERATION', description: `Ghostwriter: Synthesized ${blueprint?.length || 0} Blocks` });
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