import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialize Stripe with your Secret Key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16', // Use the latest API version
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tier, userId, email } = body;

    if (!userId || !tier) {
      return NextResponse.json({ error: "Missing user ID or tier" }, { status: 400 });
    }

    // Map your Matrix tiers to real Stripe Price IDs
    // YOU MUST REPLACE THESE WITH YOUR ACTUAL STRIPE PRICE IDs (e.g., price_1Nxyz...)
    let priceId = '';
    if (tier === 'The Artist') priceId = 'price_1T3oK7RffupaQO4bIwiS6FoV';
    if (tier === 'The Mogul') priceId = 'price_1T3oLURffupaQO4bPP3cDVJ6';

    if (!priceId) {
       return NextResponse.json({ error: "Invalid Tier" }, { status: 400 });
    }

    // Create a secure Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription', // Change to 'payment' if it's a one-time fee
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}?canceled=true`,
      metadata: {
        userId: userId,
        tier: tier,
      },
    });

    // Return the Stripe URL so the frontend can redirect the user
    return NextResponse.json({ url: session.url });

  } catch (err: any) {
    console.error("Stripe API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}