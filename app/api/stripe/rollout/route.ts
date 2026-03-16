import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

export async function POST(req: Request) {
  try {
    const { trackId, trackTitle, userId } = await req.json();

    if (!trackId || !userId) {
      return NextResponse.json({ error: "Missing track data" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Exec Rollout: ${trackTitle}`,
            description: '30-Day Marketing & Content Calendar (TikTok/IG)',
          },
          unit_amount: 1499, // $14.99
        },
        quantity: 1,
      }],
      mode: 'payment',
      // Send the trackId back in the URL so Room 08 knows exactly which track to generate!
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}?rollout_purchased=true&track_id=${trackId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}?canceled=true`,
      metadata: {
        userId: userId,
        trackId: trackId,
        type: 'exec_rollout'
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe Rollout Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}