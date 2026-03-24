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

    // 2. SURGICAL FIX: Read the body stream exactly once
    const { title, audioUrl, coverUrl, hitScore, tiktokSnippet, stageName } = await req.json();

    if (!title || !audioUrl) {
      return NextResponse.json({ error: "Missing submission payload data." }, { status: 400 });
    }

    // 3. Insert into the permanent Submissions Ledger
    const { data, error: dbError } = await supabaseAdmin
      .from('submissions')
      .insert([{
        user_id: user.id,
        title: title.toUpperCase(),
        audio_url: audioUrl,
        cover_url: coverUrl,
        hit_score: hitScore,
        tiktok_snippet: tiktokSnippet,
        stage_name: stageName,
        base_hit_score: hitScore,
        status: 'pending' // Requires Admin Node approval for Global Radio
      }])
      .select()
      .single();

    if (dbError) throw dbError;

    // 4. Increment the user's Mogul Score for completing a project
    const { data: profile } = await supabaseAdmin.from('profiles').select('mogul_score').eq('id', user.id).single();
    await supabaseAdmin.from('profiles').update({ mogul_score: (profile?.mogul_score || 0) + 50 }).eq('id', user.id);

    return NextResponse.json({ success: true, submissionId: data.id });

  } catch (error: any) {
    console.error("Submission API Error:", error);
    return NextResponse.json({ error: `DB Error: ${error.message} (Details: ${error.details || 'None'})` }, { status: 500 });
  }
}