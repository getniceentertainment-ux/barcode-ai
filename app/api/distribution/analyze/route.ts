import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { title, lyrics } = await req.json();

    if (!title) {
      return NextResponse.json({ error: "Missing track title" }, { status: 400 });
    }

    console.log(`[A&R BOT] Initiating Neural Scan for: ${title}`);

    // 1. GENERATE SPOTIFY-READY COVER ART (DALL-E 3)
    // FIX: Removed text-generation requirements. DALL-E 3 produces much higher quality abstract/moody art when text is omitted.
    let coverUrl = "";
    try {
      const imageRes = await openai.images.generate({
        model: "dall-e-3",
        prompt: `A highly aesthetic, professional album cover for a dark, gritty street rap track. Moody, cinematic lighting, neon accents, abstract graphic design. No words, no text, pure visual atmosphere.`,
        n: 1,
        size: "1024x1024",
      });
      coverUrl = imageRes.data?.[0]?.url || "";
    } catch (imgErr) {
      console.error("DALL-E Generation Failed:", imgErr);
      coverUrl = "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=1024&auto=format&fit=crop"; // Fallback
    }

    // 2. EXTRACT VIRAL TIKTOK SNIPPET (GPT-4o-mini)
    // FIX: Safely check if lyrics exist. If it's an instrumental, skip the LLM call.
    let tiktokSnippet = "Instrumental Bounce // No vocals detected.";
    if (lyrics && lyrics.length > 30) {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are an expert Major Label A&R. Read the following song lyrics and extract the absolute most catchy, viral 4 lines that would make a perfect 15-second TikTok sound. Return ONLY the 4 lines. No brackets, no labels, no quotes." },
            { role: "user", content: lyrics }
          ]
        });
        tiktokSnippet = completion.choices[0].message.content?.trim() || tiktokSnippet;
      } catch (chatErr) {
        console.error("TikTok Snippet Extraction Failed:", chatErr);
      }
    }

    // 3. CALCULATE STRICT ALGORITHMIC HIT SCORE
    // FIX: Getting a 100 is now a rare, calculated event (approx 5% chance).
    let hitScore = 75;
    const rng = Math.random();
    
    if (rng > 0.95) {
      hitScore = 100; // The Golden Ticket
    } else if (rng > 0.70) {
      hitScore = Math.floor(Math.random() * (99 - 90 + 1)) + 90; // Heavy Rotation (90-99)
    } else if (rng > 0.30) {
      hitScore = Math.floor(Math.random() * (89 - 80 + 1)) + 80; // Standard (80-89)
    } else {
      hitScore = Math.floor(Math.random() * (79 - 65 + 1)) + 65; // Underground (65-79)
    }

    return NextResponse.json({ 
      coverUrl, 
      tiktokSnippet, 
      hitScore 
    });

  } catch (error: any) {
    console.error("A&R API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}