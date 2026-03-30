import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://www.bar-code.ai";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Priority Matrix Bypass (Artist Node)',
              description: 'Skip the waitlist and permanently upgrade to an Artist Node tier. Includes 5 generation credits.',
            },
            unit_amount: 1999, // $19.99 to skip the queue
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${siteUrl}/?queue_skipped=true`,
      cancel_url: `${siteUrl}/`,
      metadata: { 
        userId: user.id, 
        type: 'queue_bypass' 
      }
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Skip Queue Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}