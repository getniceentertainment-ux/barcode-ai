import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(req: Request) {
  try {
    // SURGICAL FIX: Extracting hitScore from the frontend
    const { trackId, trackTitle, userId, hitScore } = await req.json();

    if (!userId || !trackId) {
        return NextResponse.json({ error: "Unauthorized: Missing User ID or Track ID" }, { status: 401 });
    }

    // --- ALGORITHMIC BYPASS PRICING MATH ---
    const score = typeof hitScore === 'number' ? hitScore : 0;
    const targetScore = 95; // User designated 95+ as the Upstream Target
    const pointsShort = Math.max(0, targetScore - score);

    // Base price $14.99 + $1.00 per point they are short
    const basePriceCents = 1499; 
    const penaltyCents = pointsShort * 100; 
    const finalPriceCents = basePriceCents + penaltyCents;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://www.bar-code.ai";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'The Exec: 30-Day Go-To-Market Rollout',
              // Dynamic description showing the exact penalty applied
              description: pointsShort > 0 
                ? `Independent Strategy for "${trackTitle || 'Artifact'}". Bypass Penalty Applied: -${pointsShort} pts.` 
                : `Independent Strategy & Ad Campaign for "${trackTitle || 'Artifact'}".`,
            },
            unit_amount: finalPriceCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${siteUrl}/?rollout_purchased=true&track_id=${trackId}`,
      cancel_url: `${siteUrl}/`,
      metadata: { userId, type: 'exec_rollout', track_id: trackId }
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Exec Rollout Checkout Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}