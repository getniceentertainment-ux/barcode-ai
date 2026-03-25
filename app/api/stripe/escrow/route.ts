import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// Admin client to bypass RLS for secure ledger writes
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const body = await req.text();
  const headerList = await headers();
  const signature = headerList.get('Stripe-Signature') || headerList.get('stripe-signature');

  if (!signature) return NextResponse.json({ error: "Missing Signature" }, { status: 400 });

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error(`[WEBHOOK] Signature Error: ${err.message}`);
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const meta = session.metadata || {};
    
    // Normalize metadata (supports multiple checkout route variations)
    const fulfillmentType = meta.type || meta.purchaseType;
    const effectiveUserId = meta.userId || meta.buyerId;
    const amountPaid = session.amount_total ? session.amount_total / 100 : 0;

    if (!effectiveUserId) {
      console.error("[WEBHOOK] Critical: Identity metadata missing.");
      return NextResponse.json({ error: "Missing Metadata" }, { status: 400 });
    }

    try {
      // 1. SYNC PROFILE (Captures Email & Stripe Account ID from the real session)
      await supabaseAdmin
        .from('profiles')
        .update({ 
          email: session.customer_details?.email,
          stripe_account_id: session.customer as string 
        })
        .eq('id', effectiveUserId);

      // 2. TIER ELEVATION
      if (meta.tier) {
        const creditGrant = meta.tier === 'The Mogul' ? 999999 : meta.tier === 'The Artist' ? 100 : 5;
        await supabaseAdmin
          .from('profiles')
          .update({ tier: meta.tier, credits: creditGrant })
          .eq('id', effectiveUserId);
        
        await supabaseAdmin.from('transactions').insert({
          user_id: effectiveUserId,
          amount: -amountPaid,
          type: 'TIER_UPGRADE',
          description: `Matrix Node elevated to ${meta.tier}`
        });
      }

      // 3. FULFILLMENT SWITCH
      switch (fulfillmentType) {
        case 'escrow_contract':
          // Strictly matching your new 'escrow_contracts' naming convention
          const { error: contractErr } = await supabaseAdmin.from('escrow_contracts').insert({
            payer_node_id: effectiveUserId,
            recipient_artist_id: meta.targetNodeId,
            contract_amount: amountPaid,
            contract_status: 'funded',
            interaction_type: meta.interactionType || 'feature',
            stripe_session_id: session.id
          });

          if (contractErr) throw contractErr;

          // Transaction Ledger entry for the Payer
          await supabaseAdmin.from('transactions').insert({
            user_id: effectiveUserId,
            amount: -amountPaid,
            type: 'ESCROW_LOCK',
            description: `Escrow Lock: ${meta.interactionType} with ${meta.targetNodeId}`
          });

          // Create the "Neural Pings" (These trigger your external email webhooks)
          await supabaseAdmin.from('notifications').insert([
            {
              user_id: meta.targetNodeId,
              type: 'escrow_received',
              title: 'NEW CONTRACT FUNDED',
              message: `A node has locked $${amountPaid} for a ${meta.interactionType}. Respond in Room 10.`
            },
            {
              user_id: process.env.NEXT_PUBLIC_CREATOR_ID, // Notify Admin Node
              type: 'admin_alert',
              title: 'ESCROW REVENUE SECURED',
              message: `Revenue Alert: $${amountPaid} secured between ${effectiveUserId} and ${meta.targetNodeId}.`
            }
          ]);
          break;

        case 'engineering_token':
          await supabaseAdmin.from('profiles').update({ has_engineering_token: true }).eq('id', effectiveUserId);
          break;

        case 'mastering_token':
          const { data: profile } = await supabaseAdmin.from('profiles').select('mastering_tokens').eq('id', effectiveUserId).single();
          await supabaseAdmin.from('profiles').update({ 
            mastering_tokens: (profile?.mastering_tokens || 0) + 1,
            has_mastering_token: true 
          }).eq('id', effectiveUserId);
          break;

        case 'credit_topup':
          const { data: p } = await supabaseAdmin.from('profiles').select('credits').eq('id', effectiveUserId).single();
          const topupCount = parseInt(meta.credit_amount || '50');
          await supabaseAdmin.from('profiles').update({ credits: (p?.credits || 0) + topupCount }).eq('id', effectiveUserId);
          break;

        case 'beat_lease':
          await supabaseAdmin.from('purchases').insert({
            user_id: effectiveUserId, item_type: 'beat', item_id: meta.beat_id, amount_paid: amountPaid
          });
          break;
      }

      console.log(`[STRIPE SUCCESS] Full fulfillment for User ${effectiveUserId}`);
      return NextResponse.json({ received: true });

    } catch (dbErr: any) {
      console.error(`[WEBHOOK FATAL] ${dbErr.message}`);
      return NextResponse.json({ error: "Database sync failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}