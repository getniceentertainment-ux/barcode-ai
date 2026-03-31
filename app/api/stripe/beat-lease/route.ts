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
    const { beatName, beatUrl, price, userId, producerId, beatId } = await req.json();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://www.bar-code.ai";

    let destinationAccount = null;

    // Securely resolve the Producer's Stripe Connect Account ID
    if (producerId) {
      const { data: producer } = await supabaseAdmin
        .from('profiles')
        .select('stripe_account_id')
        .eq('id', producerId)
        .maybeSingle();

      if (producer?.stripe_account_id) {
        destinationAccount = producer.stripe_account_id;
      }
    }

    const amountInCents = Math.round(price * 100);

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: beatName, description: 'Bar-Code.ai Marketplace' },
          unit_amount: amountInCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      // SURGICAL FIX: Route directly to /studio so the URL params survive the redirect!
      success_url: `${siteUrl}?beat_purchased=true&beat_url=${encodeURIComponent(beatUrl)}`,
      cancel_url: `${siteUrl}`,
      // SURGICAL FIX: Passing beat_name so the Webhook can log it properly
      metadata: { userId, type: 'beat_lease', beat_id: beatId, beat_name: beatName }
    };

    // If it's a 3rd party producer, route 80% of funds to them and keep 20% platform fee
    if (destinationAccount) {
      const platformFee = Math.round(amountInCents * 0.20); 
      sessionConfig.payment_intent_data = {
        application_fee_amount: platformFee,
        transfer_data: { destination: destinationAccount },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}