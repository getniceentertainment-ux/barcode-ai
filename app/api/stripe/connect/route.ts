import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: "Missing user ID" }, { status: 400 });

    const { data: profile } = await supabaseAdmin.from('profiles').select('email, stripe_connect_id').eq('id', userId).single();
    if (!profile) throw new Error("User not found in ledger");

    let accountId = profile.stripe_connect_id;

    // Create a new Stripe Connect Express account if they don't have one
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: profile.email,
        capabilities: { transfers: { requested: true } },
        business_type: 'individual',
      });
      accountId = account.id;
      await supabaseAdmin.from('profiles').update({ stripe_connect_id: accountId }).eq('id', userId);
    }

    // Generate the secure onboarding URL
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}?connect=refresh`,
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}?connect=success`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (err: any) {
    console.error("Stripe Connect Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}