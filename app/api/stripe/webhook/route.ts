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
  const headerList = await headers();
  const signature = headerList.get('Stripe-Signature') || headerList.get('stripe-signature');

  if (!signature) return NextResponse.json({ error: "Missing Signature" }, { status: 400 });

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error(`[WEBHOOK ERROR] Signature: ${err.message}`);
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const meta = session.metadata || {};
    
    // Identity Normalization
    const fulfillmentType = meta.type || meta.purchaseType;
    const effectiveUserId = meta.userId || meta.buyerId;
    const amountPaid = session.amount_total ? session.amount_total / 100 : 0;

    if (!effectiveUserId) {
      console.error("[WEBHOOK ERROR] Identity metadata missing.");
      return NextResponse.json({ error: "Missing Metadata" }, { status: 400 });
    }

    try {
      // 1. SYNC BASE PROFILE (Email & Customer ID mapping)
      await supabaseAdmin
        .from('profiles')
        .update({ 
          email: session.customer_details?.email,
          stripe_account_id: session.customer as string 
        })
        .eq('id', effectiveUserId);

      // 2. SUBSCRIPTION UPGRADE
      if (meta.tier) {
        const creditGrant = meta.tier === 'The Mogul' ? 999999 : meta.tier === 'The Artist' ? 100 : 5;
        await supabaseAdmin
          .from('profiles')
          .update({ tier: meta.tier, credits: creditGrant })
          .eq('id', effectiveUserId);
      }

      // 3. FULFILLMENT SWITCH
      switch (fulfillmentType) {
        case 'escrow_contract':
          // Match the new table naming: payer_node_id, recipient_artist_id, contract_amount
          await supabaseAdmin.from('escrow_contracts').insert({
            payer_node_id: effectiveUserId,
            recipient_artist_id: meta.targetNodeId,
            contract_amount: amountPaid,
            status: 'funded',
            interaction_type: meta.interactionType || 'feature',
            stripe_session_id: session.id
          });

          // Ledger entry
          await supabaseAdmin.from('transactions').insert({
            user_id: effectiveUserId,
            amount: -amountPaid,
            type: 'ESCROW_LOCK',
            description: `Escrow Secured with ${meta.targetNodeId}`
          });

          // Pings
          await supabaseAdmin.from('notifications').insert([
            {
              user_id: meta.targetNodeId,
              type: 'escrow_received',
              title: 'CONTRACT FUNDED',
              message: `A node locked $${amountPaid} for a ${meta.interactionType}.`
            },
            {
              user_id: process.env.NEXT_PUBLIC_CREATOR_ID,
              type: 'admin_alert',
              title: 'ESCROW CAPTURED',
              message: `$${amountPaid} from ${effectiveUserId} to ${meta.targetNodeId}.`
            }
          ]);
          break;

        case 'engineering_token':
          await supabaseAdmin.from('profiles')
            .update({ has_engineering_token: true })
            .eq('id', effectiveUserId);
          break;

        case 'mastering_token':
          const { data: p } = await supabaseAdmin.from('profiles').select('mastering_tokens').eq('id', effectiveUserId).single();
          await supabaseAdmin.from('profiles')
            .update({ 
              mastering_tokens: (p?.mastering_tokens || 0) + 1,
              has_mastering_token: true 
            })
            .eq('id', effectiveUserId);
          break;

        case 'credit_topup':
          const { data: c } = await supabaseAdmin.from('profiles').select('credits').eq('id', effectiveUserId).single();
          const topup = parseInt(meta.credit_amount || '50');
          await supabaseAdmin.from('profiles').update({ credits: (c?.credits || 0) + topup }).eq('id', effectiveUserId);
          break;

        case 'beat_lease':
          await supabaseAdmin.from('purchases').insert({
            user_id: effectiveUserId, item_type: 'beat', item_id: meta.beat_id, amount_paid: amountPaid
          });
          break;
      }

      console.log(`[SUCCESS] Fulfilled ${fulfillmentType} for ${effectiveUserId}`);
    } catch (dbErr: any) {
      console.error(`[DATABASE ERROR] ${dbErr.message}`);
      return NextResponse.json({ error: "Fulfillment failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}