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
    
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id, wallet_balance')
      .eq('id', userId)
      .single();
    
    if (!profile?.stripe_account_id) {
      return NextResponse.json({ error: "Stripe Connect account not linked." }, { status: 400 });
    }

    if (profile.wallet_balance < amount || amount <= 0) {
      return NextResponse.json({ error: "Insufficient funds for transfer." }, { status: 400 });
    }

    // Execute fiat transfer to user's connected bank
    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100), // Stripe uses cents
      currency: 'usd',
      destination: profile.stripe_account_id,
      description: 'GetNice Matrix Royalty Payout'
    });

    // Deduct exact amount from Supabase ledger
    await supabaseAdmin.from('profiles')
      .update({ wallet_balance: profile.wallet_balance - amount })
      .eq('id', userId);

    return NextResponse.json({ success: true, transfer: transfer.id });
  } catch (error: any) {
    console.error("Transfer error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}