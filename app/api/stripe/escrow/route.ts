import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

/**
 * PRODUCTION ESCROW ROUTE
 * This route is called by Room 10 to generate a real Stripe Checkout Session.
 * It does NOT check for signatures (that is only for the Webhook).
 */
export async function POST(req: Request) {
  try {
    const { buyerId, targetNodeId, amount, type, stageName } = await req.json();
    
    // 1. Validation Guard
    if (!buyerId || !targetNodeId) {
      console.error("[ESCROW API] Failure: Missing Node IDs.");
      return NextResponse.json({ error: "Unauthorized: Missing Identity Matrix" }, { status: 401 });
    }

    // 2. Dynamic Redirect Resolution
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://www.bar-code.ai";

    console.log(`[ESCROW API] Creating Session for ${buyerId} -> ${targetNodeId} ($${amount})`);

    // 3. Create Real Stripe Session
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {      
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Escrow Lock: ${type === 'feature' ? 'Verse Feature' : 'Live Performance'}`,
              description: `Financial contract with ${stageName}. Funds held by GetNice Records until delivery verification.`,
            },
            unit_amount: Math.round(amount * 100), // Stripe expects cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // SURGICAL FIX 1: Routing to /studio so your main controller catches it
      success_url: `${siteUrl}/?escrow_funded=true&target_node=${encodeURIComponent(targetNodeId)}&interaction=${encodeURIComponent(type)}`,
      cancel_url: `${siteUrl}/`,
      metadata: { 
        buyerId: buyerId, // SURGICAL FIX 2: Fixed undefined variable 
        targetNodeId: targetNodeId, 
        interactionType: type, 
        type: 'escrow_contract' 
      }
    };

    // SURGICAL FIX 3: Actually execute the Stripe call to create the session!
    const session = await stripe.checkout.sessions.create(sessionConfig);

    console.log(`[ESCROW API] Session Created: ${session.id}`);
    return NextResponse.json({ url: session.url });

  } catch (error: any) {
    console.error("[ESCROW API] Fatal Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}