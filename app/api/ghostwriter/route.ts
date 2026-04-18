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

const BANNED_WORDS_MAP = {
  "\\bphoenix\\b": "hustler", "\\bcinders?\\b": "ashes", "\\bsweet perfume\\b": "gasoline",
  "\\bdesert sands?\\b": "the grid", "\\bnew life blooms?\\b": "the money moves",
  "\\banonymous king\\b": "ghost", "\\bconcrete jungle\\b": "the pavement",
  "\\bjiggy\\b": "active", "\\bphat\\b": "heavy", "\\bcheddar\\b": "capital",
  "\\brags to riches\\b": "mud to margins", "\\bno pain no gain\\b": "sweat equity",
  "\\bweathered storms?\\b": "took the hits", "\\bnaysayers?\\b": "detractors",
  "\\bdarkest hour\\b": "bottom line", "\\bspirits? took flight\\b": "numbers went up",
  "\\bdreams? dare to breathe\\b": "vision stays clear", "\\brise from our knees\\b": "stand on business",
  "\\btime'?s arrow\\b": "the clock", "\\bchatter\\b": "static", "\\btapestr(?:y|ies)\\b": "blueprint",
  "\\bdelve[sd]?\\b": "dig", "\\btestaments?\\b": "proof", "\\bbeacons?\\b": "target",
  "\\bjourneys?\\b": "process", "\\bmyriad\\b": "hundred", "\\blandscapes?\\b": "market",
  "\\bnavigat(?:e|ed|ing|es)\\b": "maneuver", "\\bresonat(?:e|ed|ing|es)\\b": "connect",
  "\\bfoster(?:s|ed|ing)?\\b": "build", "\\bcatalysts?\\b": "spark", "\\bparadigms?\\b": "model",
  "\\bsynerg(?:y|ies)\\b": "leverage", "\\bunleash(?:es|ed|ing)?\\b": "deploy",
  "\\bplights?\\b": "risk", "\\bfrights?\\b": "panic", "\\bignit(?:e|es|ed|ing)\\b": "spark",
  "\\bdivine\\b": "exact", "\\bsublime\\b": "top tier", "\\bmindstreams?\\b": "focus",
  "\\bwhispers?\\b": "talk", "\\bshadows?\\b": "blindspots", "\\bdancing\\b": "moving",
  "\\bembrac(?:e|es|ed|ing)\\b": "lock in", "\\bsouls?\\b": "heads", "\\babyss(?:es)?\\b": "the red",
  "\\bvoids?\\b": "the red", "\\bchaos\\b": "static", "\\bdestin(?:y|ies)\\b": "outcome",
  "\\bfates?\\b": "odds", "\\btears\\b": "losses", "\\bsorrows?\\b": "stress",
  "\\bmelod(?:y|ies)\\b": "rhythm", "\\bsymphon(?:y|ies)\\b": "system", "\\bashes\\b": "dust",
  "\\bstrife\\b": "pressure", "\\byearning\\b": "starving", "\\bkingdoms?\\b": "boardroom",
  "\\bthrones?\\b": "desk", "\\bcrowns?\\b": "equity", "\\brealms?\\b": "zone",
  "\\blegac(?:y|ies)\\b": "portfolio", "\\bquests?\\b": "hustle", "\\bvanquish(?:es|ed|ing)?\\b": "clear",
  "\\bfortress(?:es)?\\b": "compound", "\\bprophec(?:y|ies)\\b": "forecast", "\\bomens?\\b": "signal",
  "\\bcrusades?\\b": "campaign", "\\bvanguards?\\b": "frontline", "\\bsovereigns?\\b": "owner",
  "\\bdominions?\\b": "territory", "\\bforsaken\\b": "cut off", "\\bweav(?:e|es|ed|ing)\\b": "build",
  "\\bforg(?:e|es|ed|ing)\\b": "build", "\\bcraft(?:s|ed|ing)?\\b": "build", "\\bsculpt(?:s|ed|ing)?\\b": "mold",
  "\\bflutter(?:s|ed|ing)?\\b": "shake", "\\bplung(?:e|es|ed|ing)\\b": "drop", "\\bunfurl(?:s|ed|ing)?\\b": "open",
  "\\bawaken(?:s|ed|ing)?\\b": "wake", "\\bslumber(?:s|ed|ing)?\\b": "sleep", "\\bbeckon(?:s|ed|ing)?\\b": "call",
  "\\bentwin(?:e|es|ed|ing)\\b": "lock", "\\benchant(?:s|ed|ing)?\\b": "hook", "\\bcaptivat(?:e|es|ed|ing)\\b": "trap",
  "\\billuminat(?:e|es|ed|ing)\\b": "expose", "\\btranscend(?:s|ed|ing)?\\b": "scale", "\\blucre\\b": "funds",
  "\\bserene\\b": "calm", "\\buncoil(?:s|ed|ing)?\\b": "move", "\\bveins\\b": "lines", "\\bstains\\b": "marks",
  "\\bplains\\b": "blocks", "\\brefrains\\b": "hooks", "\\bgleam(?:s|ed|ing)?\\b": "shine", "\\bbeams?\\b": "lights",
  "\\bclimb(?:s|ed|ing)?\\b": "scale", "\\bmachines?\\b": "engine", "\\bvisages?\\b": "face",
  "\\bclandestine\\b": "off-books", "\\bsupreme\\b": "top", "\\bschemes?\\b": "play", "\\bspoils?\\b": "profits"
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
    
    // 🚨 PERFECT DATA EXTRACTION: Pulling exactly what Room 03 sends
    const { 
        prompt, title, bpm, root_note, scale, stageName, tag, style, 
        blueprint, motive, struggle, hustle, useSlang, useIntel, 
        flowReference, pocket, strikeZone, hookType, flowEvolution, 
        dynamic_array, contour, isExplicit 
    } = body;

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

    // 🚨 DUMB RELAY: No more Javascript Prompt Engineering. Pass it to Python.
    const runResponse = await fetch(`https://api.runpod.ai/v2/${process.env.RUNPOD_ENDPOINT_TALON}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}` },
      body: JSON.stringify({
        input: {
          task_type: "generate", 
          prompt: prompt || "", 
          title: title || "UNTITLED",
          flowReference: flowReference,
          motive: motive, 
          struggle: struggle, 
          hustle: hustle, 
          bpm: bpm || 120, 
          root_note: root_note || "C",
          scale: scale || "minor",
          style: style || "getnice_hybrid",
          stageName: stageName || "The Artist", 
          tag: tag, 
          useSlang: useSlang, 
          useIntel: useIntel, 
          isExplicit: isExplicit ?? true,
          blueprint: blueprint,
          pocket: pocket,
          strikeZone: strikeZone,
          hookType: hookType,
          flowEvolution: flowEvolution,
          dynamic_array: dynamic_array, 
          contour: contour,             
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