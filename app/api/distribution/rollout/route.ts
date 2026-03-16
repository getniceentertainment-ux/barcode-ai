import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  try {
    // 1. SECURE JWT VERIFICATION
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Security Exception: Missing Auth Token." }, { status: 401 });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid Token." }, { status: 401 });

    const { trackId } = await req.json();
    if (!trackId) return NextResponse.json({ error: "Missing trackId" }, { status: 400 });

    // 2. FETCH TRACK DATA
    const { data: track, error: trackError } = await supabaseAdmin.from('submissions').select('*').eq('id', trackId).single();
    if (trackError || !track) throw new Error("Track not found in Vault.");

    // Prevent Double Generation if they refresh the page
    if (track.exec_rollout) {
      return NextResponse.json({ rollout: track.exec_rollout });
    }

    // 3. FETCH ORIGINAL LYRICS FROM THEIR MATRIX AUTO-SAVE
    const { data: matrixState } = await supabaseAdmin.from('matrix_states').select('state_json').eq('user_id', user.id).single();
    const lyrics = matrixState?.state_json?.generatedLyrics || "No lyrics provided - Instrumental track.";

    // 4. LLM GENERATION
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: "You are an elite Major Label Marketing Executive. Generate a highly actionable 30-day TikTok, IG Reels, and YouTube Shorts rollout content calendar for this track. Use aggressive, viral, street-smart marketing tactics. Format clearly with Week 1, Week 2, Week 3, Week 4 headings and bullet points. Include exact text overlay hooks." 
        },
        { 
          role: "user", 
          content: `Track Title: ${track.title}\nTikTok Viral Snippet: "${track.tiktok_snippet}"\n\nFull Lyrics Context:\n${lyrics}` 
        }
      ]
    });

    const rolloutPlan = completion.choices[0].message.content;

    // 5. SAVE TO VAULT
    await supabaseAdmin.from('submissions').update({ exec_rollout: rolloutPlan }).eq('id', trackId);

    return NextResponse.json({ rollout: rolloutPlan });

  } catch (error: any) {
    console.error("Exec Rollout Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}