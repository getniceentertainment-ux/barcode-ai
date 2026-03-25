import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized: Missing User ID" }, { status: 401 });
    }

    // Explicitly define the URL to avoid Build Errors
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://www.bar-code.ai";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'GetNice™ Engineering Token',
              description: 'Unlock the Vocal Suite & DSP Mixing Rack.',
            },
            unit_amount: 499, // $4.99
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // Pointing to root / ensures the UI instantly unlocks Room 05 on redirect
      success_url: `${siteUrl}/?engineering_unlocked=true`,
      cancel_url: `${siteUrl}/`,
      metadata: { 
        userId, 
        type: 'engineering_token' // Directly triggers webhook fulfillment for Room 05
      }
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Engineering Token Route Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}