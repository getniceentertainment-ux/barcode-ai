import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as Blob;
    const bpm = formData.get('bpm') as string;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio payload received." }, { status: 400 });
    }

    if (!process.env.GROQ_API_KEY) {
       return NextResponse.json({ error: "Missing GROQ_API_KEY. Please add to Vercel." }, { status: 500 });
    }

    // 1. STRICT FILE CONVERSION 
    // Groq API often rejects raw Blobs if the MIME type and filename aren't perfectly re-declared on the server.
    const buffer = await audioFile.arrayBuffer();
    const secureBlob = new Blob([buffer], { type: 'audio/webm' });

    // 2. SEND RAW AUDIO TO GROQ (Whisper Drop-in Replacement)
    const whisperFormData = new FormData();
    whisperFormData.append('file', secureBlob, 'cadence.webm');
    whisperFormData.append('model', 'whisper-large-v3'); 
    whisperFormData.append('response_format', 'json');

    const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: whisperFormData
    });

    // Capture the exact Groq error if they reject the payload
    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      console.error("Groq API Error:", errText);
      return NextResponse.json({ error: `Groq Error: ${errText}` }, { status: 502 });
    }

    const whisperData = await whisperRes.json();
    const transcribedText = whisperData.text || "";

    // 3. ALGORITHMIC FLOW ANALYSIS
    const wordCount = transcribedText.split(/\s+/).filter((w: string) => w.length > 0).length;
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