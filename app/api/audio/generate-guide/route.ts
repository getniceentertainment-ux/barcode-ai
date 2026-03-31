import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { lyrics, bpm } = await req.json();

    if (!lyrics) {
      return NextResponse.json({ error: "Missing lyrics." }, { status: 400 });
    }

    // The vocal direction tag [cheerful] or [energetic] helps steer the Orpheus model
    const steerableLyrics = `[energetic] ${lyrics}`;

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
        voice: 'troy', // Options: 'troy', 'austin', 'hannah'
        response_format: 'wav'
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Groq TTS Error:", errText);
      return NextResponse.json({ error: "Failed to generate audio from Groq." }, { status: 500 });
    }

    // Convert the fast response into an array buffer to send back to Room 04
    const audioBuffer = await response.arrayBuffer();
    
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/wav',
      }
    });

  } catch (error: any) {
    console.error("Guide Generation Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}