import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Explicitly define the URL to avoid Build Errors
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://www.bar-code.ai";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'GetNice™ Mastering Token',
              description: 'Commercial LUFS limiting and FFmpeg processing.',
            },
            unit_amount: 499,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // FIXED: Pointing to root / ensures the "Back" button works and avoids "studio" errors
      success_url: `${siteUrl}/?token_purchased=true`,
      cancel_url: `${siteUrl}/`,
      metadata: { userId, type: 'mastering_token' }
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Master Token Route Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}