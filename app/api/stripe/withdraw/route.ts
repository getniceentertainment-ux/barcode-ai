import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // 1. Check Environment Variables First
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("SERVER ERROR: STRIPE_SECRET_KEY is missing in your Vercel Environment Variables.");
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

    // 2. Authenticate the User
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: "Unauthorized Request. Missing Token." }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    
    if (authErr || !user) {
        throw new Error("Invalid or expired identity token.");
    }

    // 3. Fetch User Profile
    // SURGICAL FIX: Removed 'email' from the select query. We use the secure user.email from the auth token directly to prevent DB crashes.
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id, wallet_balance')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile) {
        throw new Error("Node profile not found in database.");
    }

    let stripeAccountId = profile.stripe_account_id;

    // 4. Create Stripe Connect account if missing
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: user.email, // Using secure auth email directly
        capabilities: {
          transfers: { requested: true },
        },
        business_type: 'individual',
      });

      stripeAccountId = account.id;

      // Save the new Stripe ID to their Supabase profile
      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update({ stripe_account_id: stripeAccountId })
        .eq('id', user.id);
        
      if (updateErr) throw new Error("Failed to save Stripe ID to Ledger.");
    }

    // 5. Generate Secure Dashboard Link
    const origin = req.headers.get('origin') || 'https://www.bar-code.ai';
    
    try {
        // Attempt to log them into their existing dashboard
        const loginLink = await stripe.accounts.createLoginLink(stripeAccountId);
        return NextResponse.json({ url: loginLink.url });
    } catch (e: any) {
        // If createLoginLink fails, it means they haven't finished the onboarding steps yet.
        // Generate an onboarding link instead.
        const accountLink = await stripe.accountLinks.create({
            account: stripeAccountId,
            refresh_url: `${origin}/studio`,
            return_url: `${origin}/studio`,
            type: 'account_onboarding',
        });
        return NextResponse.json({ url: accountLink.url });
    }

  } catch (error: any) {
    console.error("Stripe Withdraw Fatal Error:", error);
    // SURGICAL FIX: Returns the EXACT error message to the frontend so the UI Toast tells us what went wrong.
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}