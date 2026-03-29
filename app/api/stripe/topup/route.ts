import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized: Missing Identity Matrix" }, { status: 401 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://www.bar-code.ai";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: '50 AI Generation Credits',
              description: 'GPU compute tokens for FLUX.1 Visuals and Audio DSP workflows.',
            },
            unit_amount: 999, // $9.99 USD
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${siteUrl}/?topup_success=true`,
      cancel_url: `${siteUrl}/`,
      // SURGICAL: This metadata is the exact lock-and-key the Webhook needs to deposit the 50 credits
      metadata: { 
        userId, 
        type: 'credit_topup', 
        credit_amount: '50' 
      }
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Credit Top-Up Checkout Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}