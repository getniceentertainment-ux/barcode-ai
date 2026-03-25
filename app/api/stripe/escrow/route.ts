import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(req: Request) {
  try {
    const { buyerId, targetNodeId, amount, type, stageName } = await req.json();
    
    if (!buyerId || !targetNodeId) {
      return NextResponse.json({ error: "Unauthorized: ID Mismatch" }, { status: 401 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://www.bar-code.ai";

    // Create the session for the specific Feature or Booking
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Escrow Lock: ${type === 'feature' ? 'Verse Feature' : 'Live Booking'}`,
              description: `Brokerage contract with ${stageName}. Funds held by GetNice Records until delivery.`,
            },
            unit_amount: Math.round(amount * 100), // Stripe expects cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${siteUrl}/studio?escrow_success=true&node_id=${targetNodeId}`,
      cancel_url: `${siteUrl}/studio`,
      metadata: { 
        buyerId, 
        targetNodeId,
        type: 'escrow_contract',
        interactionType: type 
      }
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Escrow Route Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}