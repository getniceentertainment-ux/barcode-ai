import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // 🚨 SURGICAL FIX: Catch semanticTags from the frontend puppeteer
    const { lyrics, bpm, semanticTags } = await req.json();

    if (!lyrics) {
      return NextResponse.json({ error: "Missing lyrics." }, { status: 400 });
    }

    // --- DYNAMIC ORPHEUS STEERING ---
    // High-fidelity models need explicit emotional and pacing tags to avoid robotic delivery.
    // We dynamically adjust the steering based on the BPM passed from Room04.
    let pacingTag = "[steady]";
    if (bpm && bpm > 130) pacingTag = "[fast]";
    else if (bpm && bpm < 90) pacingTag = "[slow]";

    // Combine the base rap tag, the dynamic grid math tags, the pacing, and the lyrics
    // We use a fallback `|| ""` just in case semanticTags is somehow undefined
    const steerableLyrics = `[rap] ${semanticTags || ""} ${pacingTag} ${lyrics}`.replace(/\s+/g, ' ').trim();

    // Hitting Groq's blazing-fast OpenAI-compatible speech endpoint
    const response = await fetch('https://api.groq.com/openai/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'canopylabs/orpheus-v1-english',
        input: steerableLyrics,
        voice: 'troy', // 'troy' has the best cadence for rap/hip-hop
        response_format: 'wav', 
        speed: 1.0 // Keep base speed at 1.0; Room04 will handle the time-warping via the Glue algorithm
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Groq TTS Error:", errText);
      return NextResponse.json({ error: "Failed to generate high-fidelity audio from Groq." }, { status: 500 });
    }

    const audioBuffer = await response.arrayBuffer();
    
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/wav',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400', // Cache responses to save Groq API calls on identical lines
      }
    });

  } catch (error: any) {
    console.error("Guide Generation Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}