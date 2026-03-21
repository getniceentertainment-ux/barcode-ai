import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as Blob;
    const bpm = formData.get('bpm') as string;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio payload received." }, { status: 400 });
    }

    // Swapped to check for GROQ_API_KEY
    if (!process.env.GROQ_API_KEY) {
       throw new Error("Missing GROQ_API_KEY in environment variables.");
    }

    // 1. SEND RAW AUDIO TO GROQ (Whisper Drop-in Replacement)
    const whisperFormData = new FormData();
    whisperFormData.append('file', audioFile, 'cadence.webm');
    whisperFormData.append('model', 'whisper-large-v3'); // Groq's hosted Whisper model

    // Hitting Groq's OpenAI-compatible endpoint
    const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: whisperFormData
    });

    const whisperData = await whisperRes.json();
    if (!whisperRes.ok) {
      throw new Error(whisperData.error?.message || "Groq Neural Extraction Failed");
    }

    const transcribedText = whisperData.text || "";

    // 2. ALGORITHMIC FLOW ANALYSIS
    // Calculate Syllable/Word density over the 10-second recording window
    const wordCount = transcribedText.split(/\s+/).filter(w => w.length > 0).length;
    const durationSecs = 10; 
    const wordsPerSecond = wordCount / durationSecs;

    // Determine Architectural Flow DNA based on real math
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