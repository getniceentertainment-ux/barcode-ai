import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any,
});

// Admin client for secure server-side lookup
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    
    if (!userId) {
      return NextResponse.json({ error: "Missing Operator ID" }, { status: 401 });
    }

    // 1. Fetch the Stripe Customer ID from your 'profiles' table
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.stripe_customer_id) {
      return NextResponse.json({ 
        error: "No active billing account found. Please subscribe to a tier first." 
      }, { status: 404 });
    }

    // 2. Create a secure, one-time billing portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://bar-code.ai'}`, 
    });

    return NextResponse.json({ url: portalSession.url });

  } catch (err: any) {
    console.error("🚨 Stripe Portal Critical Failure:", err.message);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}