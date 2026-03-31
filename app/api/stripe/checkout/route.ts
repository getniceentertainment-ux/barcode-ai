import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(req: Request) {
  try {
    const { tier, userId, email } = await req.json();
    
    if (!userId || !tier) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://www.bar-code.ai";
    
    // SURGICAL FIX 1: Set the pricing dynamically so you don't need to mess with Vercel Env Variables
    const priceCents = tier === 'The Mogul' ? 9900 : 3900;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: email || undefined,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${tier} Node Access`,
              description: `Permanent upgrade to ${tier} status in the Bar-Code Matrix.`,
            },
            unit_amount: priceCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment', // Set to 'payment' for a one-time upgrade fee
      
      // SURGICAL FIX 2: Point to /studio to ensure the EntryGateway UI intercepts it and opens the doors
      success_url: `${siteUrl}/?success=true`,
      cancel_url: `${siteUrl}/`,
      
      // SURGICAL FIX 3: Added 'type: tier_upgrade'. Without this, the Master Webhook ignores the transaction!
      metadata: { 
        userId, 
        type: 'tier_upgrade',
        tier: tier 
      }
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Tier Checkout Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}