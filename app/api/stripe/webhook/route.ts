import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// Admin client to bypass RLS and secure the ledger
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
    console.error(`[STRIPE WEBHOOK] Signature Error: ${err.message}`);
    return NextResponse.json({ error: "Webhook verification failed" }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    
    // --- 1. ROBUST METADATA EXTRACTION ---
    // Handles variations in keys (userId vs buyerId) across different checkout routes
    const meta = session.metadata || {};
    const fulfillmentType = meta.type || meta.purchaseType;
    const effectiveUserId = meta.userId || meta.buyerId;
    const amountPaid = session.amount_total ? session.amount_total / 100 : 0;

    console.log(`[STRIPE WEBHOOK] Processing ${fulfillmentType} for Node: ${effectiveUserId}`);

    if (!effectiveUserId) {
      console.error("[STRIPE WEBHOOK] CRITICAL: No User ID found in metadata.");
      return NextResponse.json({ error: "Missing Identity Metadata" }, { status: 400 });
    }

    try {
      // --- 2. EMERGENCY PROFILE SYNC (Email Recovery) ---
      // If the trigger failed or signup was interrupted, we capture the email here
      if (session.customer_details?.email) {
        await supabaseAdmin
          .from('profiles')
          .update({ email: session.customer_details.email })
          .eq('id', effectiveUserId);
      }

      // --- 3. SUBSCRIPTION / TIER UPGRADE ---
      if (meta.tier) {
        const initialCredits = meta.tier === 'The Mogul' ? 999999 : meta.tier === 'The Artist' ? 100 : 5;
        await supabaseAdmin
          .from('profiles')
          .update({ 
            tier: meta.tier, 
            credits: initialCredits, 
            stripe_customer_id: session.customer as string 
          })
          .eq('id', effectiveUserId);
        
        await supabaseAdmin.from('transactions').insert({
          user_id: effectiveUserId,
          amount: -amountPaid,
          type: 'TIER_UPGRADE',
          description: `Matrix Tier Upgraded to ${meta.tier}`
        });
      }

      // --- 4. MULTI-CHANNEL FULFILLMENT SWITCH ---
      if (fulfillmentType) {
        switch (fulfillmentType) {
          
          case 'escrow_contract':
            // A. Create the Contract Record
            const { error: contractErr } = await supabaseAdmin.from('escrow_contracts').insert({
              buyer_id: effectiveUserId,
              artist_id: meta.targetNodeId,
              amount: amountPaid,
              status: 'funded',
              interaction_type: meta.interactionType || 'feature',
              stripe_session_id: session.id
            });
            if (contractErr) throw contractErr;

            // B. Write to the Transaction Ledger (For the Payer)
            await supabaseAdmin.from('transactions').insert({
              user_id: effectiveUserId,
              amount: -amountPaid,
              type: 'ESCROW_LOCK',
              description: `Escrow Secured: ${meta.interactionType || 'Interaction'} with ${meta.targetNodeId}`
            });

            // C. Neural Ping: Notify Target Artist
            await supabaseAdmin.from('notifications').insert({
              user_id: meta.targetNodeId,
              type: 'escrow_received',
              title: 'NEW CONTRACT FUNDED',
              message: `A node has locked $${amountPaid} for a ${meta.interactionType}. Open Room 10 to respond.`,
              payload: { buyer_id: effectiveUserId, amount: amountPaid }
            });

            // D. Admin Alert
            const creatorId = process.env.NEXT_PUBLIC_CREATOR_ID;
            if (creatorId) {
              await supabaseAdmin.from('notifications').insert({
                user_id: creatorId,
                type: 'admin_alert',
                title: 'ESCROW REVENUE CAPTURED',
                message: `Brokerage event: $${amountPaid} secured between ${effectiveUserId} and ${meta.targetNodeId}.`,
              });
            }
            break;

          case 'engineering_token':
            await supabaseAdmin.from('profiles').update({ has_engineering_token: true }).eq('id', effectiveUserId);
            await supabaseAdmin.from('transactions').insert({
              user_id: effectiveUserId, amount: -amountPaid, type: 'PURCHASE', description: 'Engineering Suite Unlock'
            });
            break;

          case 'mastering_token':
            const { data: pT } = await supabaseAdmin.from('profiles').select('mastering_tokens').eq('id', effectiveUserId).single();
            await supabaseAdmin.from('profiles').update({ 
              mastering_tokens: (pT?.mastering_tokens || 0) + 1,
              has_mastering_token: true 
            }).eq('id', effectiveUserId);
            await supabaseAdmin.from('transactions').insert({
              user_id: effectiveUserId, amount: -amountPaid, type: 'PURCHASE', description: 'Mastering Token Key'
            });
            break;

          case 'credit_topup':
            const { data: pC } = await supabaseAdmin.from('profiles').select('credits').eq('id', effectiveUserId).single();
            const creditPack = parseInt(meta.credit_amount || '50');
            await supabaseAdmin.from('profiles').update({ 
              credits: (pC?.credits || 0) + creditPack 
            }).eq('id', effectiveUserId);
            await supabaseAdmin.from('transactions').insert({
              user_id: effectiveUserId, amount: -amountPaid, type: 'TOPUP', description: `Purchased ${creditPack} Credits`
            });
            break;

          case 'beat_lease':
            await supabaseAdmin.from('purchases').insert({
              user_id: effectiveUserId, item_type: 'beat', item_id: meta.beat_id, amount_paid: amountPaid
            });
            await supabaseAdmin.from('transactions').insert({
              user_id: effectiveUserId, amount: -amountPaid, type: 'PURCHASE', description: `Leased Artifact: ${meta.beat_id}`
            });
            break;

          default:
            console.warn(`[STRIPE WEBHOOK] Unhandled fulfillment type: ${fulfillmentType}`);
        }
      }

      console.log(`[STRIPE WEBHOOK SUCCESS] Handshake complete for ${effectiveUserId}`);
      return NextResponse.json({ received: true });

    } catch (dbErr: any) {
      console.error(`[STRIPE WEBHOOK ERROR] DB Sync Failed: ${dbErr.message}`);
      return NextResponse.json({ error: "Database fulfillment failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}