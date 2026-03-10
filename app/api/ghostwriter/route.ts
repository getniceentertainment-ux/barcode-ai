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
    const { prompt, title, bpm, tag, style, gender, useSlang, blueprint } = body;

    // 2. CHECK LEDGER
    const { data: profile, error: dbError } = await supabaseAdmin
      .from('profiles')
      .select('credits, tier')
      .eq('id', userId)
      .single();

    if (dbError || !profile) return NextResponse.json({ error: "Identity not found in Ledger." }, { status: 401 });
    if (profile.tier !== 'The Mogul' && profile.credits <= 0) return NextResponse.json({ error: "Insufficient Generations." }, { status: 403 });

    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
    const ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_TALON;

    const thematicPrompt = title ? `SONG TITLE: "${title}". ${prompt}` : prompt;

    console.log(`[TALON] Submitting Async Job for Node ${userId.substring(0,6)}...`);

    // 3. START ASYNC JOB
    const runResponse = await fetch(`https://api.runpod.ai/v2/${ENDPOINT_ID}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RUNPOD_API_KEY}` },
      body: JSON.stringify({
        input: {
          task_type: "generate",
          prompt: thematicPrompt,
          tag: tag,
          style: style,
          blueprint: blueprint 
        }
      })
    });

    const rawText = await runResponse.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
      console.error("\n=== [RUNPOD CRASH REPORT] ===");
      console.error("HTTP Status:", runResponse.status);
      console.error("Raw Response:", rawText);
      return NextResponse.json({ error: `RunPod Connection Error (Status ${runResponse.status}).` }, { status: 500 });
    }

    if (data.status === "COMPLETED" || data.id) {
      // 4. BILLING (Only deduct if they aren't unlimited)
      if (profile.tier !== 'The Mogul') {
        await supabaseAdmin.from('profiles').update({ credits: profile.credits - 1 }).eq('id', userId);
      }
      return NextResponse.json(data.output || { jobId: data.id });
    } else {
      throw new Error(data.error || "TALON Generation failed internally.");
    }

  } catch (error: any) {
    console.error("TALON API Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}