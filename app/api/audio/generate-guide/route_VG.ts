import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // 🚨 SURGICAL FIX: Catch semanticTags AND speed from the frontend puppeteer
    const { lyrics, bpm, semanticTags, speed } = await req.json();

    if (!lyrics) {
      return NextResponse.json({ error: "Missing lyrics." }, { status: 400 });
    }

    // --- DYNAMIC ORPHEUS STEERING ---
    let pacingTag = "[steady]";
    if (bpm && bpm > 130) pacingTag = "[fast]";
    else if (bpm && bpm < 90) pacingTag = "[slow]";

    // Combine the base rap tag, the dynamic grid math tags, the pacing, and the lyrics
    const steerableLyrics = `[rap] [projecting] ${semanticTags || ""} ${pacingTag} ${lyrics}`.replace(/\s+/g, ' ').trim();

    // Dynamically apply the calculated speed multiplier (fallback to 1.0)
    const finalSpeed = speed ? parseFloat(speed) : 1.0;

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
        speed: finalSpeed // <-- FIX 1: Dynamic speed warping applied here
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
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      }
    });

  } catch (error: any) {
    console.error("Guide Generation Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}