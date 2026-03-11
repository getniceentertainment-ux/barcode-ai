import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

export async function POST(req: Request) {
  try {
    const { beatName, beatUrl, price, userId } = await req.json();

    if (!beatName || !beatUrl || !price) {
      return NextResponse.json({ error: "Missing beat data" }, { status: 400 });
    }

    // Create a secure 1-time payment session for the exact price of the beat
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Commercial Lease: ${beatName}`,
            description: 'GetNice Records Exclusive Matrix Beat',
          },
          unit_amount: Math.round(price * 100), // Convert to cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      // CRITICAL: We pass the beat data in the return URL so the Matrix knows to analyze it upon successful payment!
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}?beat_purchased=true&beat_url=${encodeURIComponent(beatUrl)}&beat_name=${encodeURIComponent(beatName)}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}?canceled=true`,
      metadata: {
        userId: userId || 'guest',
        beatName: beatName
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe Beat Lease Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}