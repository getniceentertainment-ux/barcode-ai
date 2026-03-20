import { headers } from 'next/headers';
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
  const body = await req.text();
  
  // FIXED: headers() is async in Next.js 15/16. Must await before calling .get()
  const headerList = await headers();
  const signature = headerList.get('Stripe-Signature');

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe Signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error(`Webhook Signature Verification Failed: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // GLOBAL HANDLER: Listening for successful checkouts
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const { userId, type, credit_amount, beat_id } = session.metadata || {};

    if (!userId) return NextResponse.json({ error: "No userId in metadata" }, { status: 400 });

    try {
      switch (type) {
        case 'mastering_token':
          const { data: mProfile } = await supabaseAdmin.from('profiles').select('mastering_tokens').eq('id', userId).single();
          await supabaseAdmin.from('profiles').update({ 
            mastering_tokens: (mProfile?.mastering_tokens || 0) + 1 
          }).eq('id', userId);
          break;

        case 'credit_topup':
          const { data: cProfile } = await supabaseAdmin.from('profiles').select('credits').eq('id', userId).single();
          const addAmount = parseInt(credit_amount || '50');
          await supabaseAdmin.from('profiles').update({ 
            credits: (cProfile?.credits || 0) + addAmount 
          }).eq('id', userId);
          break;

        case 'beat_lease':
          await supabaseAdmin.from('purchases').insert({
            user_id: userId,
            item_type: 'beat',
            item_id: beat_id,
            amount_paid: session.amount_total ? session.amount_total / 100 : 0,
            created_at: new Date().toISOString()
          });
          break;

        default:
          console.log("Unhandled metadata type:", type);
      }
    } catch (dbErr: any) {
      console.error("Webhook DB Update Failed:", dbErr.message);
      return NextResponse.json({ error: "Database update failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}