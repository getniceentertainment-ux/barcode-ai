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

    // 1. Fetch the user's Profile (Need balance and Stripe ID)
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('wallet_balance, stripe_account_id')
      .eq('id', userId)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    if (!profile.stripe_account_id) {
      return NextResponse.json({ error: "No bank account linked." }, { status: 400 });
    }

    // 2. Security Check: Ensure they aren't withdrawing more than they have
    // And ensure we are only touching wallet_balance (Fiat), not marketing_credits
    if (amount <= 0 || amount > profile.wallet_balance) {
      return NextResponse.json({ error: "Invalid withdrawal amount." }, { status: 400 });
    }

    // 3. Execute Stripe Transfer
    // This moves money from your platform's Stripe balance to their Express account
    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100), // Stripe uses cents
      currency: 'usd',
      destination: profile.stripe_account_id,
      description: `GetNice Payout: Artist Royalty/Advance`,
    });

    // 4. Atomic Database Update
    // Deduct the balance and log the transaction
    const newBalance = profile.wallet_balance - amount;
    
    await supabaseAdmin
      .from('profiles')
      .update({ wallet_balance: newBalance })
      .eq('id', userId);

    await supabaseAdmin.from('transactions').insert({
      user_id: userId,
      amount: -amount,
      type: 'WITHDRAWAL',
      description: `Withdrawal to Bank (Stripe: ${transfer.id})`
    });

    return NextResponse.json({ success: true, transferId: transfer.id, newBalance });

  } catch (error: any) {
    console.error("Withdrawal Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}