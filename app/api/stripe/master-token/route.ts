import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'GetNice™ Mastering Token',
              description: 'Server-side FFmpeg processing and -14 LUFS commercial limiting.',
            },
            unit_amount: 499, // $4.99
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // The crucial redirect parameters
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/studio?token_purchased=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/studio`,
      metadata: {
        userId: userId,
        type: 'mastering_token'
      }
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe Checkout Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}