import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId, amount } = await req.json();

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('wallet_balance, stripe_account_id')
      .eq('id', userId)
      .single();

    if (profileErr || !profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    if (!profile.stripe_account_id) return NextResponse.json({ error: "No bank account linked." }, { status: 400 });

    // 1. SURGICAL FIX: Ensure we are using absolute numbers and rounding to avoid float errors
    const requestAmount = Math.abs(parseFloat(amount));
    
    if (requestAmount <= 0 || requestAmount > profile.wallet_balance) {
      return NextResponse.json({ error: "Invalid withdrawal amount." }, { status: 400 });
    }

    // 2. STRIPE TRANSFER EXECUTION
    // Wrap in a sub-try/catch to capture specific Stripe rejection reasons
    try {
      const transfer = await stripe.transfers.create({
        amount: Math.round(requestAmount * 100), // Convert to Cents
        currency: 'usd',
        destination: profile.stripe_account_id,
        description: `GetNice Payout: ${userId}`,
      });

      // 3. DATABASE SYNC (Only happens if Stripe succeeds)
      const newBalance = profile.wallet_balance - requestAmount;
      
      await supabaseAdmin
        .from('profiles')
        .update({ wallet_balance: newBalance })
        .eq('id', userId);

      await supabaseAdmin.from('transactions').insert({
        user_id: userId,
        amount: -requestAmount,
        type: 'WITHDRAWAL',
        description: `Withdrawal to Bank (Stripe ID: ${transfer.id})`
      });

      return NextResponse.json({ success: true, newBalance });

    } catch (stripeError: any) {
      console.error("STRIPE REJECTION:", stripeError.message);
      return NextResponse.json({ error: `Stripe Rejected: ${stripeError.message}` }, { status: 400 });
    }

  } catch (error: any) {
    console.error("WITHDRAWAL ROUTE CRASH:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}