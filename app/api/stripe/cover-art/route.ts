import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16', // Use your current API version
});

export async function POST(req: Request) {
  try {
    const { userId, trackTitle } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "User ID required for checkout." }, { status: 401 });
    }

    // 1. Create a secure Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'], // <--- SURGICAL FIX: Removed invalid wallet strings
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `A&R Vision: ${trackTitle || 'Track'} Cover Art`,
              description: 'Proprietary DALL-E 3 generated cover art locked to your matrix artifact.',
            },
            unit_amount: 299, // $2.99 in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // We pass the user ID and track info in the metadata so your webhook knows who bought it
      metadata: {
        userId: userId,
        trackTitle: trackTitle,
        purchase_type: 'cover_art'
      },
      // Return the user to the Matrix upon success
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://www.bar-code.ai'}/?cover_art_purchased=true&track_id=${trackId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://www.bar-code.ai'}`,
    });

    // 2. Return the secure Stripe URL to the frontend
    return NextResponse.json({ url: session.url });

  } catch (error: any) {
    console.error("Stripe Checkout Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}