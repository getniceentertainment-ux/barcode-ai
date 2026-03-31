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
    const meta = session.metadata || {};
    
    // Extract comprehensive metadata from all potential checkout routes
    const { 
      userId, 
      buyerId,
      type, 
      purchaseType, 
      tier, 
      credit_amount, 
      beat_id, 
      track_id,
      targetNodeId, 
      interactionType 
    } = meta;
    
    // Normalize the fulfillment type and the primary user (the payer)
    const fulfillmentType = type || purchaseType;
    const effectiveUserId = userId || buyerId || session.client_reference_id;

    if (!effectiveUserId) {
      console.error("Webhook Error: No identification metadata found.");
      return NextResponse.json({ error: "Missing Metadata" }, { status: 400 });
    }

    const amountTotalDollars = session.amount_total ? session.amount_total / 100 : 0;

    try {
      // --- MULTI-CHANNEL FULFILLMENT SWITCH ---
      switch (fulfillmentType) {
        
        // 1. THE EXEC ROLLOUT BYPASS (Payola Math & Room 11 Trigger)
        case 'exec_rollout': {
          const { data: sub } = await supabaseAdmin
            .from('submissions')
            .select('hit_score, base_hit_score')
            .eq('id', track_id)
            .single();
          
          let updatePayload: any = { 
            exec_bypass: true, 
            campaign_day: 1,   
            exec_rollout: "AWAITING_NEURAL_SYNTHESIS" 
          };
          
          if (sub && sub.hit_score < 95) {
            updatePayload.base_hit_score = sub.base_hit_score || sub.hit_score; 
            updatePayload.hit_score = 95; 
          }

          await supabaseAdmin.from('submissions').update(updatePayload).eq('id', track_id);
          
          await supabaseAdmin.from('transactions').insert({
            user_id: effectiveUserId,
            amount: -amountTotalDollars,
            type: 'UPSELL_PURCHASE',
            description: `Independent Rollout Bypass: ${track_id}`
          });
          console.log(`[STRIPE] Exec Rollout authorized for track: ${track_id}`);
          break;
        }

        // 2. WAITLIST QUEUE BYPASS (Node Upgrade)
        case 'queue_bypass': {
          await supabaseAdmin.from('profiles').update({ 
            tier: 'The Artist',
            credits: 100, // Included baseline credits
            credits_remaining: 100
          }).eq('id', effectiveUserId);

          await supabaseAdmin.from('transactions').insert({
            user_id: effectiveUserId,
            amount: -amountTotalDollars,
            type: 'UPSELL_PURCHASE',
            description: `Priority Bypass: Artist Node Activation`
          });
          console.log(`[STRIPE] Queue bypassed. Upgraded User ${effectiveUserId} to The Artist`);
          break;
        }

        // 3. SUBSCRIPTION / TIER UPGRADE LOGIC
        case 'tier_upgrade': {
          if (tier) {
            const initialCredits = tier === 'The Mogul' ? 999999 : tier === 'The Artist' ? 100 : 5;
            await supabaseAdmin.from('profiles').update({ 
                tier: tier, 
                credits: initialCredits, 
                credits_remaining: initialCredits, 
                stripe_customer_id: session.customer as string 
            }).eq('id', effectiveUserId);

            await supabaseAdmin.from('transactions').insert({
              user_id: effectiveUserId,
              amount: -amountTotalDollars,
              type: 'NODE_UPGRADE',
              description: `Vault Registration: Activated ${tier} Node`
            });
            console.log(`[STRIPE] Upgraded User ${effectiveUserId} to ${tier}`);
          }
          break;
        }

        // 4. ESCROW PIPELINE: Financial Capture for Features/Bookings
        case 'escrow_contract': {
          await supabaseAdmin.from('escrow_contracts').insert({
            buyer_id: effectiveUserId,
            artist_id: targetNodeId,
            amount: amountTotalDollars,
            status: 'funded',
            interaction_type: interactionType || 'feature',
            stripe_session_id: session.id
          });

          // TRIGGER NEURAL PING: Notify the target artist
          await supabaseAdmin.from('notifications').insert({
            user_id: targetNodeId,
            type: 'escrow_received',
            title: 'NEW CONTRACT FUNDED',
            message: `A node has locked funds for a ${interactionType}. Open Room 10 to respond.`,
            payload: { buyer_id: effectiveUserId, amount: session.amount_total }
          });

          // Log transaction for Room 08 Ledger
          await supabaseAdmin.from('transactions').insert({
             user_id: effectiveUserId,
             amount: -amountTotalDollars,
             type: 'ESCROW_LOCK',
             description: `Escrow Funded for Node: ${targetNodeId?.substring(0,8)}`
          });

          console.log(`[STRIPE] Escrow secured between ${effectiveUserId} and ${targetNodeId}`);
          break;
        }

        // 5. ENGINEERING TOKEN: $4.99 Gate Unlock
        case 'engineering_token': {
          await supabaseAdmin.from('profiles').update({ has_engineering_token: true }).eq('id', effectiveUserId);
          console.log(`[STRIPE] Engineering Suite unlocked for ${effectiveUserId}`);
          break;
        }

        // 6. MASTERING TOKEN: $4.99 Counter Increment
        case 'mastering_token': {
          const { data: profileT } = await supabaseAdmin.from('profiles').select('mastering_tokens').eq('id', effectiveUserId).single();
          await supabaseAdmin.from('profiles').update({ 
            mastering_tokens: (profileT?.mastering_tokens || 0) + 1,
            has_mastering_token: true 
          }).eq('id', effectiveUserId);
          console.log(`[STRIPE] Mastering Token added for ${effectiveUserId}`);
          break;
        }

        // 7. CREDIT TOP UP
        case 'credit_topup': {
          const { data: profileC } = await supabaseAdmin.from('profiles').select('credits, credits_remaining').eq('id', effectiveUserId).single();
          const amount = parseInt(credit_amount || '50');
          await supabaseAdmin.from('profiles').update({ 
            credits: (profileC?.credits || 0) + amount,
            credits_remaining: (profileC?.credits_remaining || 0) + amount
          }).eq('id', effectiveUserId);
          console.log(`[STRIPE] Added ${amount} credits for ${effectiveUserId}`);
          break;
        }

        // 8. BEAT LEASING
        case 'beat_lease':
        case 'beat_purchase': {
          await supabaseAdmin.from('purchases').insert({
            user_id: effectiveUserId,
            item_type: 'beat',
            item_id: beat_id,
            amount_paid: amountTotalDollars
          });
          
          await supabaseAdmin.from('transactions').insert({
            user_id: effectiveUserId,
            amount: -amountTotalDollars,
            type: 'BEAT_PURCHASE',
            description: `Acquired Commercial Beat License: ${beat_id || 'Marketplace Asset'}`
          });
          console.log(`[STRIPE] Beat ${beat_id} leased by ${effectiveUserId}`);
          break;
        }

        // 9. COVER ART
        case 'cover_art': {
          // Cover art API triggers instantly via URL intercept, but we log the payment here!
          await supabaseAdmin.from('transactions').insert({
            user_id: effectiveUserId,
            amount: -amountTotalDollars,
            type: 'UPSELL_PURCHASE',
            description: `FLUX.1 AI Cover Art: ${track_id || 'Artifact'}`
          });
          console.log(`[STRIPE] Cover Art purchased by ${effectiveUserId}`);
          break;
        }

        default:
          console.warn("Unrecognized fulfillment type:", fulfillmentType);
      }
    } catch (dbErr: any) {
      console.error("Fulfillment Database Error:", dbErr.message);
      return NextResponse.json({ error: "Database sync failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}