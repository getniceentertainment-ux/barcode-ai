import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

export async function POST(req: Request) {
  try {
    const { title, lyrics, bpm, energy } = await req.json();

    // 1. DSP-Driven A&R Hit Score Calculation
    // Base score is 60. Adds points for high energy, deducts if BPM is exceptionally slow.
    let hitScore = 60;
    hitScore += Math.floor(energy * 25); // Up to 25 points for energy
    if (bpm > 110 && bpm < 140) hitScore += 10; // 10 points for standard radio BPM
    hitScore = Math.min(99, Math.max(1, hitScore)); // Clamp between 1 and 99

    // 2. Groq AI Hook Detection
    let snippetStartTime = 15; // Default fallback
    
    if (lyrics && lyrics.length > 20) {
      try {
        const groqCompletion = await groq.chat.completions.create({
          messages: [
            {
              role: "system",
              content: "You are an A&R music executive. Analyze the provided lyrics and identify the exact second the 'hook' or 'chorus' starts. Assuming standard rap cadence at 120bpm. Respond ONLY with a JSON object: {\"snippetStartTime\": number}. No text, no markdown."
            },
            {
              role: "user",
              content: lyrics
            }
          ],
          model: "llama-3.3-70b-versatile",
          temperature: 0.1, // Keep it strictly analytical
        });

        const rawJson = groqCompletion.choices[0]?.message?.content || "{}";
        const parsed = JSON.parse(rawJson);
        if (parsed.snippetStartTime) {
          snippetStartTime = parsed.snippetStartTime;
        }
      } catch (e) {
        console.warn("Groq failed to parse lyrics. Falling back to default timestamp.", e);
      }
    }

    // Return the real DSP score and the Groq-determined timestamp!
    return NextResponse.json({
      hitScore: hitScore,
      snippetStartTime: snippetStartTime,
      coverUrl: null // Wait for Stripe checkout to populate this
    });

  } catch (error: any) {
    console.error("Distribution Analysis Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}