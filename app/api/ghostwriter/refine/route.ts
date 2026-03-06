import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, originalLine, instruction, style } = body;

    if (!userId || !originalLine || !instruction) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // 1. SECURITY: Check database for valid tier and credits
    const { data: profile, error: dbError } = await supabaseAdmin
      .from('profiles')
      .select('credits, tier')
      .eq('id', userId)
      .single();

    if (dbError || !profile) {
      return NextResponse.json({ error: "Security Exception: Identity not found in Ledger." }, { status: 401 });
    }

    if (profile.tier !== 'The Mogul' && profile.credits <= 0) {
      return NextResponse.json({ error: "Insufficient Generations." }, { status: 403 });
    }

    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
    const ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_TALON;

    // We trick the existing Worker 1 'generate' handler by passing a 1-bar blueprint
    const refinePrompt = `REWRITE THIS LINE: "${originalLine}". INSTRUCTION: ${instruction}. Keep it the exact same length.`;

    // 2. Call Worker 1 (TALON GPU Node)
    const response = await fetch(`https://api.runpod.ai/v2/${ENDPOINT_ID}/runsync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RUNPOD_API_KEY}`
      },
      body: JSON.stringify({
        input: {
          task_type: "generate",
          prompt: refinePrompt,
          style: style || "drill",
          tag: "Micro-refinement DNA",
          blueprint: [
            { type: "VERSE", bars: 1 } 
          ]
        }
      })
    });

    const data = await response.json();

    if (data.status === "COMPLETED") {
      // 3. BILLING: Deduct 1 credit if not on Unlimited tier
      if (profile.tier !== 'The Mogul') {
        await supabaseAdmin
          .from('profiles')
          .update({ credits: profile.credits - 1 })
          .eq('id', userId);
      }

      // Clean up the output
      let refinedLyrics = data.output.lyrics || "";
      refinedLyrics = refinedLyrics.replace(/\[.*?\]\n/g, '').trim();
      
      return NextResponse.json({ refinedLine: refinedLyrics });
    } else {
      throw new Error(data.error || "Refinement failed");
    }

  } catch (error: any) {
    console.error("Refinement API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}