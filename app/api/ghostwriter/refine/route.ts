import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // 1. FORTRESS LOCKDOWN: CRYPTOGRAPHIC JWT VERIFICATION
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Security Exception: Missing Auth Token." }, { status: 401 });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: "Security Exception: Forged or Expired Token." }, { status: 401 });
    }

    const userId = user.id; // STRICT OVERRIDE

    const body = await req.json();
    const { originalLine, instruction, style, bpm = 120 } = body;

    if (!originalLine || !instruction) return NextResponse.json({ error: "Missing parameters" }, { status: 400 });

    const { data: profile, error: dbError } = await supabaseAdmin.from('profiles').select('credits, tier').eq('id', userId).single();
    if (dbError || !profile) return NextResponse.json({ error: "Identity not found." }, { status: 401 });
    if (profile.tier !== 'The Mogul' && profile.credits <= 0) return NextResponse.json({ error: "Insufficient Generations." }, { status: 403 });

    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
    const ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_TALON;

    // THE FIX: The Surgical Refinement Directive
    const refinePrompt = `TALON Engine: Perform a Vocabulary Purge. You are currently mirroring the input text too closely.

Apply Concrete Rule: Replace all abstract thoughts (e.g., 'life I chose', 'staying strong') with Concrete Nouns (e.g., 'Blacked out Beamer', 'Safe in the floorboards').
Shorten Bar Length: Each line must have exactly ONE pipe (|) and no more than 8 words total to match the ${bpm} BPM tempo.
Kill the Regurgitation: Do not use any phrases found in the PREVIOUS LYRICS section. Generate 100% new content using the established Style Sampling.

REWRITE THIS LINE: "${originalLine}". INSTRUCTION: ${instruction}`;

    const response = await fetch(`https://api.runpod.ai/v2/${ENDPOINT_ID}/runsync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RUNPOD_API_KEY}` },
      body: JSON.stringify({
        input: {
          task_type: "generate",
          prompt: refinePrompt,
          style: style || "drill",
          tag: "Micro-refinement DNA",
          blueprint: [{ type: "VERSE", bars: 1 }]
        }
      })
    });

    const data = await response.json();

    if (data.status === "COMPLETED") {
      if (profile.tier !== 'The Mogul') {
        await supabaseAdmin.from('profiles').update({ credits: profile.credits - 1 }).eq('id', userId);
      }
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