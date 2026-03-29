import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(req: Request) {
  try {
    const { trackId, trackTitle, userId, hitScore } = await req.json();

    if (!userId || !trackId) {
      return NextResponse.json({ error: "Unauthorized: Missing Node ID" }, { status: 401 });
    }

    // Flat $14.99 SaaS Fee
    const finalPriceCents = 1499; 
    
    // Calculate what they are unlocking for the receipt description
    const score = typeof hitScore === 'number' ? hitScore : 0;
    const proRatedAdvance = Math.floor(1500 * (score / 100));

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://www.bar-code.ai";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'The Exec: Pro-Rated Algorithmic Campaign',
            description: `Unlocking $${proRatedAdvance} in matching Ad Spend (Score: ${score}/100) for "${trackTitle}".`,
          },
          unit_amount: finalPriceCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      // SURGICAL: Passes the Session ID back for instant unlock
      success_url: `${siteUrl}/?rollout_purchased=true&track_id=${trackId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/`,
      metadata: { userId, type: 'exec_rollout', track_id: trackId }
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Rollout Checkout Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}