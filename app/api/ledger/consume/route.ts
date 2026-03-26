import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Uses Admin Key to bypass user manipulation
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

    const { action, description } = await req.json();

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('tier, credits, has_engineering_token, has_mastering_token, mastering_tokens')
      .eq('id', user.id)
      .single();
      
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    const isMogul = profile.tier === 'The Mogul';

    // ROUTE 1: Room 04 (Vocal Takes)
    if (action === 'record_take') {
      if (!isMogul) {
        if ((profile.credits || 0) < 1) return NextResponse.json({ error: "Insufficient credits" }, { status: 403 });
        await supabaseAdmin.from('profiles').update({ credits: profile.credits - 1 }).eq('id', user.id);
        await supabaseAdmin.from('transactions').insert({ user_id: user.id, amount: -1, type: 'GENERATION', description: description || 'The Booth: Hardware Vocal Take' });
      }
    } 
    // ROUTE 2: Room 05 (Engineering Suite)
    else if (action === 'engineering') {
      if (!isMogul) {
        if (!profile.has_engineering_token) return NextResponse.json({ error: "Missing Engineering Token" }, { status: 403 });
        await supabaseAdmin.from('profiles').update({ has_engineering_token: false }).eq('id', user.id);
        await supabaseAdmin.from('transactions').insert({ user_id: user.id, amount: 0, type: 'TOKEN_CONSUME', description: 'Vocal Suite: Engineered Mix' });
      }
    } 
    // ROUTE 3: Room 06 (Mastering Suite)
    else if (action === 'mastering') {
      if (!isMogul) {
        if (profile.has_mastering_token) {
          await supabaseAdmin.from('profiles').update({ has_mastering_token: false }).eq('id', user.id);
        } else if ((profile.mastering_tokens || 0) > 0) {
          await supabaseAdmin.from('profiles').update({ mastering_tokens: profile.mastering_tokens - 1 }).eq('id', user.id);
        } else {
          return NextResponse.json({ error: "Missing Mastering Token" }, { status: 403 });
        }
        await supabaseAdmin.from('transactions').insert({ user_id: user.id, amount: 0, type: 'TOKEN_CONSUME', description: 'Mastering: Commercial Export' });
      }
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Ledger Consume Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}