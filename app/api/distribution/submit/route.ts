import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // 1. Verify JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid Token" }, { status: 401 });

    const body = await req.json();
    const { title, audioUrl, coverUrl, hitScore, tiktokSnippet } = body;

    if (!title || !audioUrl) {
      return NextResponse.json({ error: "Missing submission payload data." }, { status: 400 });
    }

    // 2. Insert into the permanent Submissions Ledger
    const { data, error: dbError } = await supabaseAdmin
      .from('submissions')
      .insert([{
        user_id: user.id,
        title: title.toUpperCase(),
        audio_url: audioUrl,
        cover_url: coverUrl,
        hit_score: hitScore,
        tiktok_snippet: tiktokSnippet,
        stage_name: stageName // <--- ADD THIS LINE
	base_hit_score: hitScore // <--- ADD THIS LINE
        status: 'pending' // Requires Admin Node approval for Global Radio, but shows on Profile immediately
      }])
      .select()
      .single();

    if (dbError) throw dbError;

    // 3. Increment the user's Mogul Score for completing a project
    const { data: profile } = await supabaseAdmin.from('profiles').select('mogul_score').eq('id', user.id).single();
    await supabaseAdmin.from('profiles').update({ mogul_score: (profile?.mogul_score || 0) + 50 }).eq('id', user.id);

    return NextResponse.json({ success: true, submissionId: data.id });

  } catch (error: any) {
    console.error("Submission API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}