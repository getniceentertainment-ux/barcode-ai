import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// 1. Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// 2. Initialize Supabase Admin (Bypasses RLS to secure the ledger)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
      console.error("[WEBHOOK ERROR] Missing Stripe Signature or Webhook Secret.");
      return NextResponse.json({ error: "Missing signature or secret" }, { status: 400 });
    }

    let event: Stripe.Event;

    // 3. Cryptographic Signature Validation
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err: any) {
      console.error(`[WEBHOOK ERROR] Signature Verification Failed: ${err.message}`);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // 4. Handle Successful Checkouts
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const meta = session.metadata;
      
      if (!meta || !meta.type) {
        console.error("[WEBHOOK WARNING] Checkout completed but no metadata type found.", session.id);
        return NextResponse.json({ received: true });
      }

      // Safely resolve the User ID (either passed in metadata or as client_reference_id)
      const effectiveUserId = meta.userId || meta.buyerId || session.client_reference_id;
      if (!effectiveUserId) {
         console.error("[WEBHOOK WARNING] No User ID attached to session metadata.");
         return NextResponse.json({ received: true });
      }

      const amountPaid = session.amount_total ? session.amount_total / 100 : 0;
      console.log(`[WEBHOOK] Processing ${meta.type} for User ${effectiveUserId} ($${amountPaid})`);

      // ============================================================================
      // THE FULFILLMENT ROUTER
      // ============================================================================
      switch (meta.type) {

        // --- ROOM 05: ENGINEERING TOKEN ---
        case 'engineering_token':
          await supabaseAdmin.from('profiles')
            .update({ has_engineering_token: true })
            .eq('id', effectiveUserId);
            
          await supabaseAdmin.from('transactions').insert({
            user_id: effectiveUserId, amount: -amountPaid, type: 'TOKEN_PURCHASE', description: 'Unlocked Vocal Engineering Suite'
          });
          break;

        // --- ROOM 06: MASTERING TOKEN ---
        case 'mastering_token':
          await supabaseAdmin.from('profiles')
            .update({ has_mastering_token: true })
            .eq('id', effectiveUserId);
            
          await supabaseAdmin.from('transactions').insert({
            user_id: effectiveUserId, amount: -amountPaid, type: 'TOKEN_PURCHASE', description: 'Unlocked Commercial Mastering Suite'
          });
          break;

        // --- ROOM 07: FLUX.1 COVER ART ---
        case 'cover_art':
          await supabaseAdmin.from('transactions').insert({
            user_id: effectiveUserId, amount: -amountPaid, type: 'UPSELL_PURCHASE', description: `FLUX.1 Cover Art Generation`
          });
          break;

        // --- ROOM 11: THE EXEC ROLLOUT (INDEPENDENT SAAS PURCHASE) ---
        case 'exec_rollout':
          // 1. Instantly unlock Room 11 for the user's specific track (AS INDEPENDENT)
          if (meta.track_id) {
             await supabaseAdmin.from('submissions')
              .update({ rollout_purchased: true }) // <-- Flips the SaaS switch, NOT the Label switch
              .eq('id', meta.track_id);
          }
            
          // 2. Log the SaaS revenue in the ledger (No $1500 advance for independent buyers)
          await supabaseAdmin.from('transactions').insert([
            { 
              user_id: effectiveUserId, 
              amount: -amountPaid, 
              type: 'SAAS_PURCHASE', 
              description: `The Exec: 30-Day Strategy Unlocked (Independent)` 
            }
          ]);
          break;

        // --- TOP-UP: GPU GENERATION CREDITS ---
        case 'credit_topup':
          const addedCredits = parseInt(meta.credit_amount || '50');
          const { data: currentProf } = await supabaseAdmin.from('profiles').select('credits').eq('id', effectiveUserId).single();
          
          await supabaseAdmin.from('profiles')
            .update({ credits: (currentProf?.credits || 0) + addedCredits })
            .eq('id', effectiveUserId);

          await supabaseAdmin.from('transactions').insert({
            user_id: effectiveUserId, amount: -amountPaid, type: 'CREDIT_PURCHASE', description: `Purchased ${addedCredits} AI Generations`
          });
          break;

        // --- ROOM 10: ESCROW BROKERAGE ---
        case 'escrow_contract':
          await supabaseAdmin.from('escrow_contracts').insert({
             buyer_id: meta.buyerId,
             artist_id: meta.targetNodeId,
             amount: amountPaid,
             status: 'funded',
             interaction_type: meta.interactionType || 'feature',
             stripe_session_id: session.id
          });
          
          await supabaseAdmin.from('transactions').insert({
            user_id: effectiveUserId, amount: -amountPaid, type: 'ESCROW_LOCK', description: `Funds secured for ${meta.interactionType} contract.`
          });
          break;

        // --- ROOM 01: BEAT LEASING ---
        case 'beat_lease':
          await supabaseAdmin.from('transactions').insert({
            user_id: effectiveUserId, amount: -amountPaid, type: 'MARKETPLACE_PURCHASE', description: `Beat Lease Acquired`
          });
          break;

        // --- ENTRY GATEWAY: SUBSCRIPTION TIER UPGRADE ---
        case 'tier_upgrade':
          const tierName = meta.tier || 'The Artist';
          let startingCredits = tierName === 'The Mogul' ? 999999 : 100;
          
          await supabaseAdmin.from('profiles')
            .update({ tier: tierName, credits: startingCredits })
            .eq('id', effectiveUserId);

          await supabaseAdmin.from('transactions').insert({
            user_id: effectiveUserId, amount: -amountPaid, type: 'TIER_UPGRADE', description: `Upgraded to ${tierName} Node`
          });
          break;

        default:
          console.warn(`[WEBHOOK] Unrecognized metadata type: ${meta.type}`);
      }

      console.log(`[WEBHOOK SUCCESS] Fulfillment executed for ${meta.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("[WEBHOOK FATAL ERROR]", error);
    return NextResponse.json({ error: "Internal Webhook Error" }, { status: 500 });
  }
}