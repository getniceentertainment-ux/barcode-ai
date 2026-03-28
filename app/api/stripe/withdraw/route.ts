import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

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
    if (!user) return NextResponse.json({ error: "Invalid identity token" }, { status: 401 });

    // 1. Fetch user profile to check for existing Stripe Account and Wallet Balance
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id, wallet_balance, email')
      .eq('id', user.id)
      .single();

    if (!profile) throw new Error("Node profile not found.");

    let stripeAccountId = profile.stripe_account_id;

    // 2. If they don't have a Stripe Connect account, create one
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: profile.email || user.email,
        capabilities: {
          transfers: { requested: true },
        },
        business_type: 'individual',
      });

      stripeAccountId = account.id;

      // Save the Stripe ID to their Supabase profile
      await supabaseAdmin
        .from('profiles')
        .update({ stripe_account_id: stripeAccountId })
        .eq('id', user.id);
    }

    // 3. Generate a highly secure, one-time-use link to their Stripe Dashboard
    const origin = req.headers.get('origin') || 'https://www.bar-code.ai';
    
    // If we just created the account, they need the onboarding link. 
    // If it exists, we generate a login link to their dashboard.
    try {
        const loginLink = await stripe.accounts.createLoginLink(stripeAccountId);
        return NextResponse.json({ url: loginLink.url });
    } catch (e: any) {
        // If createLoginLink fails, it usually means they haven't finished onboarding yet.
        const accountLink = await stripe.accountLinks.create({
            account: stripeAccountId,
            refresh_url: `${origin}/studio`,
            return_url: `${origin}/studio`,
            type: 'account_onboarding',
        });
        return NextResponse.json({ url: accountLink.url });
    }

  } catch (error: any) {
    console.error("Stripe Withdraw Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}