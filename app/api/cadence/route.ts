import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // 1. AUTHENTICATION CHECK
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Security Exception: Missing Auth Token." }, { status: 401 });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: "Security Exception: Invalid Identity." }, { status: 401 });
    }

    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const bpm = formData.get('bpm') as string;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio payload received." }, { status: 400 });
    }

    // 2. SECURE CREDIT CHECK
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('credits, tier')
      .eq('id', user.id)
      .single();

    if (!profile) return NextResponse.json({ error: "Node not found." }, { status: 404 });

    const isMogul = profile.tier === 'The Mogul';
    if (!isMogul && (profile.credits || 0) < 1) {
      return NextResponse.json({ error: "Insufficient Generations. Top up at The Bank." }, { status: 403 });
    }

    if (!process.env.GROQ_API_KEY) {
       return NextResponse.json({ error: "Neural Link Offline (API Key Missing)." }, { status: 500 });
    }

    // 3. EXECUTE WHISPER EXTRACTION
    const whisperFormData = new FormData();
    whisperFormData.append('file', audioFile, 'cadence.webm');
    whisperFormData.append('model', 'whisper-large-v3'); 
    whisperFormData.append('response_format', 'json');

    const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: whisperFormData
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      return NextResponse.json({ error: `Neural Extraction Failed: ${errText}` }, { status: 502 });
    }

    const whisperData = await whisperRes.json();
    const transcribedText = whisperData.text || "";

    // 4. ACCOUNTING: Deduct credit ONLY after successful AI transcription
    if (!isMogul) {
      await supabaseAdmin
        .from('profiles')
        .update({ credits: profile.credits - 1 })
        .eq('id', user.id);
    }

    // 5. ALGORITHMIC FLOW ANALYSIS
    const wordCount = transcribedText.split(/\s+/).filter((w: string) => w.length > 0).length;
    const durationSecs = 10; 
    const wordsPerSecond = wordCount / durationSecs;

    let predictedId = "getnice_hybrid";
    let detectedName = "GetNice Hybrid Triplet";

    if (wordsPerSecond > 3.2) {
      predictedId = "chopper";
      detectedName = "Chopper (Fast)";
    } else if (wordsPerSecond > 2.2 && Number(bpm) >= 138) {
      predictedId = "drill";
      detectedName = "NY Drill";
    } else if (wordsPerSecond <= 1.5 && wordCount > 2) {
      predictedId = "melodic_trap";
      detectedName = "Melodic Trap";
    } else if (wordCount > 0) {
      predictedId = "boom_bap";
      detectedName = "Boom Bap";
    }

    return NextResponse.json({
      styleId: predictedId,
      styleName: detectedName,
      transcription: transcribedText,
      wordsPerSecond: wordsPerSecond,
      totalWords: wordCount
    });

  } catch (error: any) {
    console.error("Cadence Analysis Fatal Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}