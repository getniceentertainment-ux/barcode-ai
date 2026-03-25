import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(req: Request) {
  try {
    const { buyerId, targetNodeId, amount, type, stageName } = await req.json();
    
    // Safety check: Prevent anonymous escrow
    if (!buyerId || !targetNodeId) {
      return NextResponse.json({ error: "Unauthorized: Missing Identity Matrix" }, { status: 401 });
    }

    // Use environment variable for dynamic redirects
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://www.bar-code.ai";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Escrow Lock: ${type === 'feature' ? 'Verse Feature' : 'Live Performance'}`,
              description: `Financial contract with ${stageName}. Funds held by GetNice Records until delivery verification.`,
            },
            unit_amount: Math.round(amount * 100), // Stripe requires cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // The success flag triggers the "Secured" UI in Room 10
      success_url: `${siteUrl}/?escrow_success=true&node_id=${targetNodeId}`,
      cancel_url: `${siteUrl}/`,
      metadata: { 
        buyerId, 
        targetNodeId,
        interactionType: type,
        type: 'escrow_contract' // This triggers the specific case in your webhook
      }
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Escrow Route Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}