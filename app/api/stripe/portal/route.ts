import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// Initialize Supabase Admin to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "Missing User ID" }, { status: 400 });
    }

    // Securely look up their Stripe Customer ID in your database
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({ error: "No active billing account found. Generate an API key first." }, { status: 404 });
    }

    // Generate the secure portal login link from Stripe
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/dev-portal`,
    });

    // Send the URL back to the frontend
    return NextResponse.json({ url: portalSession.url });

  } catch (err: any) {
    console.error("Stripe Portal Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}