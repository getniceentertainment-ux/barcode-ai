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
  const signature = headerList.get('Stripe-Signature') || headerList.get('stripe-signature');

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
    
    // Extract metadata injected by our checkout routes
    const { userId, type, purchaseType, tier, credit_amount, beat_id } = session.metadata || {};
    
    // Normalize the fulfillment type
    const fulfillmentType = type || purchaseType;

    if (!userId) {
      console.error("Webhook Error: No userId found in metadata.");
      return NextResponse.json({ error: "Missing Metadata" }, { status: 400 });
    }

    try {
      // --- 1. SUBSCRIPTION / TIER UPGRADE LOGIC ---
      if (tier) {
        const initialCredits = tier === 'The Mogul' ? 999999 : tier === 'The Artist' ? 100 : 5;
        const { error } = await supabaseAdmin
          .from('profiles')
          .update({ 
            tier: tier, 
            credits_remaining: initialCredits,
            stripe_customer_id: session.customer as string 
          })
          .eq('id', userId);
          
        if (error) throw error;
        console.log(`[STRIPE] Upgraded User ${userId} to ${tier}`);
      }

      // --- 2. MICRO-TRANSACTION / TOKEN FULFILLMENT LOGIC ---
      if (fulfillmentType) {
        switch (fulfillmentType) {
          
          // THE $4.99 ENGINEERING GATE UNLOCK
          case 'engineering_token':
            const { error: engErr } = await supabaseAdmin
              .from('profiles')
              .update({ has_engineering_token: true })
              .eq('id', userId);
              
            if (engErr) throw engErr;
            console.log(`[STRIPE] Engineering Suite unlocked for ${userId}`);
            break;

          // THE $4.99 MASTERING GATE UNLOCK
          case 'mastering_token':
            const { data: profileT } = await supabaseAdmin
              .from('profiles')
              .select('mastering_tokens')
              .eq('id', userId)
              .single();
            
            const { error: mastErr } = await supabaseAdmin
              .from('profiles')
              .update({ 
                mastering_tokens: (profileT?.mastering_tokens || 0) + 1,
                has_mastering_token: true 
              })
              .eq('id', userId);
              
            if (mastErr) throw mastErr;
            console.log(`[STRIPE] Mastering Token unlocked for ${userId}`);
            break;

          // TOP UP CREDITS
          case 'credit_topup':
            const { data: profileC } = await supabaseAdmin
              .from('profiles')
              .select('credits, credits_remaining') 
              .eq('id', userId)
              .single();
              
            const amount = parseInt(credit_amount || '50');
            const { error: topupErr } = await supabaseAdmin
              .from('profiles')
              .update({ 
                credits: (profileC?.credits || 0) + amount,
                credits_remaining: (profileC?.credits_remaining || 0) + amount
              })
              .eq('id', userId);
              
            if (topupErr) throw topupErr;
            console.log(`[STRIPE] Added ${amount} credits for ${userId}`);
            break;

          // BEAT LEASING
          case 'beat_lease':
            const { error: beatErr } = await supabaseAdmin.from('purchases').insert({
              user_id: userId,
              item_type: 'beat',
              item_id: beat_id,
              amount_paid: session.amount_total ? session.amount_total / 100 : 0
            });
            
            if (beatErr) throw beatErr;
            console.log(`[STRIPE] Beat ${beat_id} leased by ${userId}`);
            break;

          default:
            console.warn("Unrecognized fulfillment type:", fulfillmentType);
        }
      }
    } catch (dbErr: any) {
      console.error("Fulfillment Database Error:", dbErr.message);
      return NextResponse.json({ error: "Database sync failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}