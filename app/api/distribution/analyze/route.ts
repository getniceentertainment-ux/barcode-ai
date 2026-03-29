import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const dynamic = 'force-dynamic';

// --- ENTERPRISE INFRASTRUCTURE: UPSTASH REDIS ---
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// Strict Rate Limiter: 5 A&R Scans per minute per Node to protect API budgets
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
    // 1. SECURITY GUARD: Identity Verification
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: "Security Exception: Missing Authorization Token." }, { status: 401 });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: "Security Exception: Invalid Node Identity." }, { status: 401 });
    }

    // 2. DOS GUARD: Upstash Rate Limiting
    const { success } = await ratelimit.limit(user.id);
    if (!success) {
      return NextResponse.json({ error: "Rate Limit Exceeded. The A&R Neural Net is cooling down." }, { status: 429 });
    }

    // 3. DSP PAYLOAD INGESTION
    const { title, lyrics, bpm, blueprint, flowDNA } = await req.json();

    if (!bpm || !blueprint) {
      return NextResponse.json({ error: "Missing required DSP architecture data (BPM/Blueprint)." }, { status: 400 });
    }

    // -------------------------------------------------------------
    // 4. THE GETNICE 3-CODE ALGORITHM (ORION STANDARDS)
    // -------------------------------------------------------------
    // BASELINE: Brutal starting score to prevent trash from passing.
    let hitScore = 20; 

    // CODE 0: PRODUCTION METRICS (The 808 & Pulse) - Max 15 Points
    const trackBpm = Number(bpm) || 120;
    if (trackBpm >= 120 && trackBpm <= 160) {
        hitScore += 15; // Optimal trap / modern hip-hop bounce
    } else if (trackBpm >= 85 && trackBpm < 120) {
        hitScore += 8;  // Standard boom-bap / R&B pacing
    } else {
        hitScore += 2;  // Irregular pacing
    }

    // CODE 1: THE HOOK (CTR - Click-Through Rate) - Max 25 Points
    if (blueprint && blueprint.length > 0) {
        const firstType = blueprint[0].type?.toUpperCase() || "";
        if (firstType === "HOOK" || firstType === "CHORUS") {
            hitScore += 25; // Instant attention capture
        } else if (blueprint.length >= 3 && blueprint[0].type === "VERSE" && blueprint[1].type === "VERSE" && (blueprint[2].type === "HOOK" || blueprint[2].type === "CHORUS")) {
            hitScore += 20; // Slow build, storytelling approach
        } else if (firstType === "INTRO" && blueprint[1]?.type === "HOOK") {
            hitScore += 15; // Intro leading straight to hook
        } else {
            hitScore += 5; // Unoptimized arrangement
        }
    }

    // CODE 2: THE REELING (AVP - Average View Percentage) - Max 20 Points
    if (blueprint && blueprint.length > 0) {
        const avgBarLength = blueprint.reduce((acc: number, val: any) => acc + val.bars, 0) / blueprint.length;
        if (avgBarLength <= 8) {
            hitScore += 20; // High pattern interrupt frequency
        } else if (avgBarLength <= 12) {
            hitScore += 12; // Standard pacing
        } else {
            hitScore += 4; // Blocks too long, listener fatigue likely
        }
    }

    // CODE 3: THE ADDICTION (APV) - Max 20 Points
    if (flowDNA && flowDNA.syllableDensity) {
        if (flowDNA.syllableDensity >= 4.5) {
            hitScore += 20; // Highly complex, signature chopper/drill flow
        } else if (flowDNA.syllableDensity >= 3.0) {
            hitScore += 12; // Solid rhythmic pocket
        } else {
            hitScore += 5; // Basic delivery
        }
    } else {
        hitScore += 5; 
    }

    // -------------------------------------------------------------
    // 5. LYRICAL A&R & VIRAL SLICING (Groq LLM)
    // -------------------------------------------------------------
    let tiktokSnippet = "Instrumental artifact. No lyrical snippet isolated.";
    
    if (process.env.GROQ_API_KEY && lyrics && lyrics !== "No lyrics provided") {
        const systemPrompt = `You are a ruthless Major Label A&R algorithm scoring a track.
Analyze the lyrics against the '2-4' storytelling method (strong hits on beats 2 and 4) and raw authenticity.
You must award between 0 and 20 bonus points based on lyrical swagger, flow variation, and storytelling.
You must also extract the absolute best 4-bar section for a TikTok Viral Snippet (15 seconds max).

Return ONLY a raw JSON object (no markdown, no backticks):
{
  "lyricScore": 15,
  "tiktokSnippet": "The 4 exact lines of lyrics"
}`;
        try {
            const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
               method: 'POST',
               headers: {
                 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                 'Content-Type': 'application/json'
               },
               body: JSON.stringify({
                 model: 'llama3-8b-8192',
                 messages: [
                   { role: 'system', content: systemPrompt },
                   { role: 'user', content: `Track: ${title}\nLyrics:\n${lyrics}` }
                 ],
                 temperature: 0.2
               })
            });

            if (groqRes.ok) {
                const groqData = await groqRes.json();
                let content = groqData.choices[0].message.content;
                content = content.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(content);
                
                const bonus = typeof parsed.lyricScore === 'number' ? parsed.lyricScore : 10;
                hitScore += bonus;
                tiktokSnippet = parsed.tiktokSnippet || tiktokSnippet;
            } else {
                hitScore += 10; // Fallback
            }
        } catch (e) {
            console.error("Groq Lyrical Analysis Failed, using fallback points", e);
            hitScore += 10; 
        }
    } else {
         hitScore += 10; // Fallback if no lyrics or API key missing
    }

    // --- FINAL NORMALIZATION ---
    hitScore = Math.min(100, Math.max(0, Math.floor(hitScore)));

    return NextResponse.json({ 
      hitScore, 
      tiktokSnippet,
      coverUrl: "" // Cover art is explicitly handled via Stripe Upsell
    });

  } catch (error: any) {
    console.error("A&R Scan Fatal Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}