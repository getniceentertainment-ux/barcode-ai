import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  try {
    const { userId, amount } = await req.json();
    if (!userId || !amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid payout request" }, { status: 400 });
    }

    const { data: profile } = await supabaseAdmin.from('profiles').select('stripe_connect_id, wallet_balance').eq('id', userId).single();
    
    if (!profile?.stripe_connect_id) {
      return NextResponse.json({ error: "Stripe Connect account not linked." }, { status: 403 });
    }

    if (profile.wallet_balance < amount) {
      return NextResponse.json({ error: "Insufficient wallet balance." }, { status: 400 });
    }

    // Execute the physical payout to the connected bank account via Stripe
    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      destination: profile.stripe_connect_id,
      description: 'GetNice Records Master Royalty / Escrow Payout',
    });

    // Deduct from the Supabase Ledger
    await supabaseAdmin.from('profiles').update({ wallet_balance: profile.wallet_balance - amount }).eq('id', userId);

    return NextResponse.json({ success: true, transferId: transfer.id });
  } catch (err: any) {
    console.error("Stripe Transfer Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}