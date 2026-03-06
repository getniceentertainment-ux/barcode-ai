import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId, referralCode } = await req.json();

    if (!userId || !referralCode) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    // 1. Check the new user's profile
    const { data: newUser, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('referred_by, credits, referral_code')
      .eq('id', userId)
      .single();

    if (userError || !newUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // 2. SECURITY: Check if they already used a code, or if they are trying to use their OWN code!
    if (newUser.referred_by !== null) {
      return NextResponse.json({ error: "You have already claimed a referral code." }, { status: 403 });
    }
    if (newUser.referral_code === referralCode) {
      return NextResponse.json({ error: "You cannot refer yourself." }, { status: 403 });
    }

    // 3. Find the Hustler (the person who owns the code)
    const { data: hustler, error: hustlerError } = await supabaseAdmin
      .from('profiles')
      .select('id, credits, total_referrals')
      .eq('referral_code', referralCode)
      .single();

    if (hustlerError || !hustler) {
      return NextResponse.json({ error: "Invalid referral code." }, { status: 404 });
    }

    // 4. THE PAYOUT: Give BOTH users +10 credits, and mark the new user as 'referred'
    await supabaseAdmin.from('profiles').update({ 
      credits: newUser.credits + 10,
      referred_by: hustler.id 
    }).eq('id', userId);

    await supabaseAdmin.from('profiles').update({ 
      credits: hustler.credits + 10,
      total_referrals: hustler.total_referrals + 1 
    }).eq('id', hustler.id);

    return NextResponse.json({ success: true, message: "10 Credits injected to both accounts." });

  } catch (error: any) {
    console.error("Referral API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}