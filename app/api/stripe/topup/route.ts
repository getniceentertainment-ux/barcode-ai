import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialize Stripe with your Secret Key from Vercel Environment Variables
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    // 1. Authentication Guard
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized: Missing User ID" }, { status: 401 });
    }

    // 2. Create the Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'GetNice™ Credit Pack',
              description: '50 High-Fidelity Generation Credits for Bar-Code.ai',
              images: ['https://bar-code.ai/og-image.png'], // Optional: Add your logo URL here
            },
            unit_amount: 999, // $9.99 USD
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // 3. Dynamic Redirects for Live Deployment
      // Ensure NEXT_PUBLIC_BASE_URL is set to https://yourdomain.com in Vercel
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/studio?topup_success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/studio`,
      
      // 4. Metadata for Webhook Processing
      // This allows your Supabase Webhook to know WHO to give the credits to
      metadata: {
        userId: userId,
        type: 'credit_topup',
        credit_amount: '50'
      }
    });

    // Return the secure Stripe URL to the frontend
    return NextResponse.json({ url: session.url });

  } catch (error: any) {
    console.error("Stripe Top-Up Session Error:", error);
    return NextResponse.json({ 
      error: "Failed to initialize secure checkout. Please try again." 
    }, { status: 500 });
  }
}