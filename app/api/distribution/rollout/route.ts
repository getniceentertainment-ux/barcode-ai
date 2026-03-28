import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const { trackId } = await req.json();

    // 1. Fetch Track Data from Vault
    const { data: track, error: trackErr } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .eq('id', trackId)
      .single();
      
    if (trackErr || !track) throw new Error("Track not found in Vault.");
    if (!process.env.GROQ_API_KEY) throw new Error("Missing GROQ_API_KEY");

    // 2. Groq LLM Generation
    const systemPrompt = `You are 'The Exec', a ruthless, multi-platinum hip-hop marketing genius.
    Your job is to generate a highly aggressive, viral 30-day rollout calendar for a new track release.
    Format it beautifully using markdown. Do not be generic. Use modern guerrilla tactics (TikTok hooks, influencer seeding, Discord leaks, IG Reels).
    Keep it concise, actionable, and formatted day-by-day or week-by-week.`;

    const userMessage = `Track Title: ${track.title}
    Hit Score: ${track.hit_score}/100
    Designated Viral Snippet: "${track.tiktok_snippet || "Use the main hook"}"
    
    Generate the 30-day rollout strategy now.`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.8,
        max_tokens: 1500,
      })
    });

    const groqData = await groqRes.json();
    if (!groqRes.ok) throw new Error(groqData.error?.message || "LLM Generation Failed");

    const rollout = groqData.choices[0].message.content;

    // 3. Save permanently to Supabase Vault
    await supabaseAdmin
      .from('submissions')
      .update({ exec_rollout: rollout })
      .eq('id', trackId);

    return NextResponse.json({ rollout });
  } catch (error: any) {
    console.error("Rollout Gen Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}