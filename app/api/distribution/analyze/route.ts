import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { title, lyrics, bpm, blueprint, flowDNA } = await req.json();

    // -------------------------------------------------------------
    // THE GETNICE 3-CODE ALGORITHM (ORION STANDARDS)
    // -------------------------------------------------------------
    // BASELINE: Brutal starting score to prevent trash from passing.
    let hitScore = 20; 

    // 1. PRODUCTION METRICS (The 808 & Pulse) - Max 15 Points
    // "Select BPM (usually 120-160 for trap)... strong bass is essential"
    const trackBpm = Number(bpm) || 120;
    if (trackBpm >= 120 && trackBpm <= 160) {
        hitScore += 15; // Optimal trap / modern hip-hop bounce
    } else if (trackBpm >= 85 && trackBpm < 120) {
        hitScore += 8;  // Standard boom-bap / R&B pacing
    } else {
        hitScore += 2;  // Irregular pacing
    }

    // 2. CODE 1: THE HOOK (CTR - Click-Through Rate) - Max 25 Points
    // "Start with the hook (B-A-B-A-B) or two verses before the first chorus"
    if (blueprint && blueprint.length > 0) {
        const firstType = blueprint[0].type.toUpperCase();
        if (firstType === "HOOK" || firstType === "CHORUS") {
            hitScore += 25; // Instant attention capture (Highest CTR)
        } else if (blueprint.length >= 3 && blueprint[0].type === "VERSE" && blueprint[1].type === "VERSE" && (blueprint[2].type === "HOOK" || blueprint[2].type === "CHORUS")) {
            hitScore += 20; // Slow build, storytelling approach (2 verses then hook)
        } else if (firstType === "INTRO" && blueprint[1]?.type === "HOOK") {
            hitScore += 15; // Intro leading straight to hook
        } else {
            hitScore += 5; // Slow burn or unoptimized arrangement, lower CTR probability
        }
    }

    // 3. CODE 2: THE REELING (AVP - Average View Percentage) - Max 20 Points
    // "Audio pacing, pattern interrupts to maintain Average View Percentage"
    if (blueprint && blueprint.length > 0) {
        const avgBarLength = blueprint.reduce((acc: number, val: any) => acc + val.bars, 0) / blueprint.length;
        
        // Frequent structure changes (pattern interrupts) keep listener engaged
        if (avgBarLength <= 8) {
            hitScore += 20; // High pattern interrupt frequency
        } else if (avgBarLength <= 12) {
            hitScore += 12; // Standard pacing
        } else {
            hitScore += 4; // Blocks are too long, high chance of listener fatigue
        }
    }

    // 4. CODE 3: THE ADDICTION (APV) - Max 20 Points
    // "Unique vocal cadence or sonic signature"
    if (flowDNA && flowDNA.syllableDensity) {
        if (flowDNA.syllableDensity >= 4.5) {
            hitScore += 20; // Highly complex, signature chopper/drill flow
        } else if (flowDNA.syllableDensity >= 3.0) {
            hitScore += 12; // Solid rhythmic pocket
        } else {
            hitScore += 5; // Basic/Lazy delivery
        }
    } else {
        hitScore += 5; 
    }

    // -------------------------------------------------------------
    // 5. LYRICAL A&R & VIRAL SLICING (Groq LLM)
    // -------------------------------------------------------------
    // Evaluates "2-4" storytelling methods and punchlines
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
            console.error("Groq Analysis Failed, using fallback points", e);
            hitScore += 10; 
        }
    } else {
         hitScore += 10; // Fallback if no lyrics or API key
    }

    // --- FINAL NORMALIZATION ---
    hitScore = Math.min(100, Math.max(0, Math.floor(hitScore)));

    return NextResponse.json({ 
      hitScore, 
      tiktokSnippet,
      coverUrl: "" // Cover art generation is handled strictly via the Stripe Upsell in Room 07
    });

  } catch (error: any) {
    console.error("A&R Mathematical Scan Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}