import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(req: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("CRITICAL: Missing STRIPE_SECRET_KEY in Vercel Environment Variables.");
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16', 
    });

    const body = await req.json();
    const { tier, userId, email } = body;

    if (!userId || !tier) {
      return NextResponse.json({ error: "Missing user ID or tier" }, { status: 400 });
    }

    // Map your Matrix tiers to secure Environment Variables
    let priceId = '';
    if (tier === 'The Artist') priceId = process.env.STRIPE_ARTIST_PRICE_ID || '';
    if (tier === 'The Mogul') priceId = process.env.STRIPE_MOGUL_PRICE_ID || '';

    if (!priceId) {
       throw new Error(`CRITICAL: Missing Vercel Environment Variable for ${tier} (e.g., STRIPE_ARTIST_PRICE_ID). You must add your Stripe Price ID to Vercel.`);
    }

    // Create a secure Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: email || undefined,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription', 
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://bar-code.ai'}?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://bar-code.ai'}?canceled=true`,
      metadata: {
        userId: userId,
        tier: tier,
      },
    });

    // Return the Stripe URL so the frontend can securely redirect the user
    return NextResponse.json({ url: session.url });

  } catch (err: any) {
    console.error("Stripe API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}