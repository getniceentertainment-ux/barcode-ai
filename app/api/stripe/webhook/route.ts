import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// Admin client to bypass RLS for fulfillment
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const body = await req.text();
  const headerList = await headers();
  const signature = headerList.get('Stripe-Signature');

  if (!signature) {
    return NextResponse.json({ error: "Missing Signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error(`Webhook Signature Error: ${err.message}`);
    return NextResponse.json({ error: "Webhook verification failed" }, { status: 400 });
  }

  // Handle Successful Payments
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const { userId, type, credit_amount, beat_id } = session.metadata || {};

    if (!userId) {
      console.error("Webhook Error: No userId found in metadata.");
      return NextResponse.json({ error: "Missing Metadata" }, { status: 400 });
    }

    try {
      switch (type) {
        case 'mastering_token':
          // 1. Fulfill Mastering Token
          const { data: profileT } = await supabaseAdmin
            .from('profiles')
            .select('mastering_tokens')
            .eq('id', userId)
            .single();
          
          await supabaseAdmin
            .from('profiles')
            .update({ mastering_tokens: (profileT?.mastering_tokens || 0) + 1 })
            .eq('id', userId);
          break;

        case 'credit_topup':
          // 2. Fulfill Credit Pack
          const { data: profileC } = await supabaseAdmin
            .from('profiles')
            .select('credits')
            .eq('id', userId)
            .single();
            
          const amount = parseInt(credit_amount || '50');
          await supabaseAdmin
            .from('profiles')
            .update({ credits: (profileC?.credits || 0) + amount })
            .eq('id', userId);
          break;

        case 'beat_lease':
          // 3. Fulfill Beat Lease
          await supabaseAdmin.from('purchases').insert({
            user_id: userId,
            item_type: 'beat',
            item_id: beat_id,
            amount_paid: session.amount_total ? session.amount_total / 100 : 0
          });
          break;

        default:
          console.warn("Unrecognized fulfillment type:", type);
      }
    } catch (dbErr: any) {
      console.error("Fulfillment Database Error:", dbErr.message);
      return NextResponse.json({ error: "Database sync failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}