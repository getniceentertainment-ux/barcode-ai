import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// Admin client to bypass RLS for secure fulfillment
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
    
    // Extract comprehensive metadata from all potential checkout routes
    const { 
      userId, 
      buyerId,
      type, 
      purchaseType, 
      tier, 
      credit_amount, 
      beat_id, 
      targetNodeId, 
      interactionType 
    } = session.metadata || {};
    
    // Normalize the fulfillment type and the primary user (the payer)
    const fulfillmentType = type || purchaseType;
    const effectiveUserId = userId || buyerId;

    if (!effectiveUserId) {
      console.error("Webhook Error: No identification metadata found.");
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
            credits: initialCredits, // Standard credit column
            credits_remaining: initialCredits, // Display column for Matrix
            stripe_customer_id: session.customer as string 
          })
          .eq('id', effectiveUserId);
          
        if (error) throw error;
        console.log(`[STRIPE] Upgraded User ${effectiveUserId} to ${tier}`);
      }

      // --- 2. MULTI-CHANNEL FULFILLMENT SWITCH ---
      if (fulfillmentType) {
        switch (fulfillmentType) {
          
          // ESCROW PIPELINE: Financial Capture for Features/Bookings
          case 'escrow_contract':
            // 1. Create the pending contract record in the ledger
            const { error: contractErr } = await supabaseAdmin.from('escrow_contracts').insert({
              buyer_id: effectiveUserId,
              artist_id: targetNodeId,
              amount: session.amount_total ? session.amount_total / 100 : 0,
              status: 'funded',
              interaction_type: interactionType,
              stripe_session_id: session.id
            });

            if (contractErr) throw contractErr;

            // 2. TRIGGER NEURAL PING: Notify the target artist
            await supabaseAdmin.from('notifications').insert({
              user_id: targetNodeId,
              type: 'escrow_received',
              title: 'NEW CONTRACT FUNDED',
              message: `A node has locked funds for a ${interactionType}. Open Room 10 to respond.`,
              payload: { buyer_id: effectiveUserId, amount: session.amount_total }
            });
            console.log(`[STRIPE] Escrow secured between ${effectiveUserId} and ${targetNodeId}`);
            break;

          // ENGINEERING TOKEN: $4.99 Gate Unlock
          case 'engineering_token':
            const { error: engErr } = await supabaseAdmin
              .from('profiles')
              .update({ has_engineering_token: true })
              .eq('id', effectiveUserId);
              
            if (engErr) throw engErr;
            console.log(`[STRIPE] Engineering Suite unlocked for ${effectiveUserId}`);
            break;

          // MASTERING TOKEN: $4.99 Counter Increment
          case 'mastering_token':
            const { data: profileT } = await supabaseAdmin
              .from('profiles')
              .select('mastering_tokens')
              .eq('id', effectiveUserId)
              .single();
            
            const { error: mastErr } = await supabaseAdmin
              .from('profiles')
              .update({ 
                mastering_tokens: (profileT?.mastering_tokens || 0) + 1,
                has_mastering_token: true 
              })
              .eq('id', effectiveUserId);
              
            if (mastErr) throw mastErr;
            console.log(`[STRIPE] Mastering Token added for ${effectiveUserId}`);
            break;

          // CREDIT TOP UP
          case 'credit_topup':
            const { data: profileC } = await supabaseAdmin
              .from('profiles')
              .select('credits, credits_remaining') 
              .eq('id', effectiveUserId)
              .single();
              
            const amount = parseInt(credit_amount || '50');
            const { error: topupErr } = await supabaseAdmin
              .from('profiles')
              .update({ 
                credits: (profileC?.credits || 0) + amount,
                credits_remaining: (profileC?.credits_remaining || 0) + amount
              })
              .eq('id', effectiveUserId);
              
            if (topupErr) throw topupErr;
            console.log(`[STRIPE] Added ${amount} credits for ${effectiveUserId}`);
            break;

          // BEAT LEASING
          case 'beat_lease':
            const { error: beatErr } = await supabaseAdmin.from('purchases').insert({
              user_id: effectiveUserId,
              item_type: 'beat',
              item_id: beat_id,
              amount_paid: session.amount_total ? session.amount_total / 100 : 0
            });
            
            if (beatErr) throw beatErr;
            console.log(`[STRIPE] Beat ${beat_id} leased by ${effectiveUserId}`);
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