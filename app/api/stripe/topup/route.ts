import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized: Missing User ID" }, { status: 401 });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'GetNice™ Credit Pack',
              description: '50 High-Fidelity Generation Credits for Bar-Code.ai',
            },
            unit_amount: 999,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/studio?topup_success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/studio`,
      metadata: {
        userId: userId,
        type: 'credit_topup',
        credit_amount: '50'
      }
    });

    return NextResponse.json({ url: session.url });

  } catch (error: any) {
    // This log will appear in your Vercel Function Logs
    console.error("Stripe Session Error:", error.message);
    return NextResponse.json({ 
      error: error.message || "Internal Server Error" 
    }, { status: 500 });
  }
}