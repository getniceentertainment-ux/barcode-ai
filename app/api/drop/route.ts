import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Uses Admin Key to securely fetch the artifact, completely bypassing RLS blocks
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const trackId = searchParams.get('trackId');
    if (!trackId) return NextResponse.json({ error: "Missing trackId" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('submissions')
      .select('id, title, cover_url, audio_url, user_id, stage_name')
      .eq('id', trackId)
      .single();

    if (error || !data) throw new Error("Artifact not found in ledger.");

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
}