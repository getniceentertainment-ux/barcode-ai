import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(req: Request) {
  try {
    // SURGICAL FIX: We ensure trackId is destructured from the request body right here
    const { trackId, trackTitle, userId } = await req.json();
    
    if (!userId || !trackId) {
        return NextResponse.json({ error: "Unauthorized: Missing User ID or Track ID" }, { status: 401 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://www.bar-code.ai";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'FLUX.1 Premium Cover Art',
              description: `AI Visual Generation for "${trackTitle || 'Artifact'}"`,
            },
            unit_amount: 299, // $2.99 USD
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // SURGICAL FIX: The URL now perfectly matches the Interceptor lock-and-key
      success_url: `${siteUrl}/?cover_art_purchased=true&track_id=${trackId}`,
      cancel_url: `${siteUrl}/`,
      metadata: { userId, type: 'cover_art', track_id: trackId }
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Cover Art Checkout Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}