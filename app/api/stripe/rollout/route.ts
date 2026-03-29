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

    const score = typeof hitScore === 'number' ? hitScore : 0;
    const targetScore = 95; 
    const pointsShort = Math.max(0, targetScore - score);

    const basePriceCents = 1499; 
    const penaltyCents = pointsShort * 100; 
    const finalPriceCents = basePriceCents + penaltyCents;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://www.bar-code.ai";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'The Exec: 30-Day Go-To-Market Rollout',
            description: pointsShort > 0 
              ? `Algorithmic Strategy for "${trackTitle}". Bypass Fee: +$${pointsShort}.00 (-${pointsShort} pts shy of target).` 
              : `Premium Strategy & Ad Campaign for "${trackTitle}".`,
          },
          unit_amount: finalPriceCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      // SURGICAL FIX: We inject Stripe's native {CHECKOUT_SESSION_ID} so Room 11 can verify it instantly
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