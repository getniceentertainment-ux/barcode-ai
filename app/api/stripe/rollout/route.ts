import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(req: Request) {
  try {
    const { trackId, trackTitle, userId } = await req.json();
    if (!userId || !trackId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://www.bar-code.ai";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'The Exec: 30-Day Rollout Strategy',
              description: `Algorithmic Marketing Campaign Specifically For "${trackTitle}"`,
            },
            unit_amount: 1499, // $14.99 USD
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // Passes the track ID back so Room 08 knows which track to generate the rollout for
      success_url: `${siteUrl}/studio?rollout_purchased=true&track_id=${trackId}`,
      cancel_url: `${siteUrl}/`,
      metadata: { userId, type: 'exec_rollout', track_id: trackId }
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}