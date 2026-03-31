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
            unit_amount: Math.round(amount * 100), // Stripe expects cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // Success URL includes the flag that Room 10 looks for to show the "Funds Secured" checkmark
      success_url: `${siteUrl}/?escrow_success=true&node_id=${targetNodeId}`,
      cancel_url: `${siteUrl}`,
      
      // CRITICAL: Metadata used by the ACTUAL Webhook to fulfill the order
      metadata: { 
        buyerId: buyerId, 
        targetNodeId: targetNodeId,
        interactionType: type,
        type: 'escrow_contract' 
      }
    });

    console.log(`[ESCROW API] Session Created: ${session.id}`);
    return NextResponse.json({ url: session.url });

  } catch (error: any) {
    console.error("[ESCROW API] Fatal Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}