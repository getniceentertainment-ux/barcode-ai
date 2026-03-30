import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature') || '';
    const event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const meta = session.metadata;

      // 1. THE EXEC ROLLOUT BYPASS (Your custom Ego Boost Math)
      if (meta?.type === 'exec_rollout') {
        const { data: sub } = await supabaseAdmin
          .from('submissions')
          .select('hit_score, base_hit_score')
          .eq('id', meta.track_id)
          .single();
        
        let updatePayload: any = { 
          exec_bypass: true, // THE TRUMP CARD!
          campaign_day: 1,   // Populated FIRST as requested
          exec_rollout: "AWAITING_NEURAL_SYNTHESIS" // Modified as requested
        };
        
        // THE MATH: Base Score + Penalty Difference = 95
        if (sub && sub.hit_score < 95) {
          updatePayload.base_hit_score = sub.base_hit_score || sub.hit_score; // Save the real score
          updatePayload.hit_score = 95; // Force the public ego boost to 95
        }

        // Update the Ledger
        await supabaseAdmin.from('submissions').update(updatePayload).eq('id', meta.track_id);
        
        // Log the transaction for Room 08
        await supabaseAdmin.from('transactions').insert({
          user_id: meta.userId || session.client_reference_id,
          amount: -(session.amount_total! / 100),
          type: 'UPSELL_PURCHASE',
          description: `Independent Rollout Bypass: ${meta.track_id}`
        });
      }

      // 2. WAITLIST QUEUE BYPASS (Node Upgrade to The Artist)
      if (meta?.type === 'queue_bypass') {
        const userId = meta.userId || session.client_reference_id;
        
        // Permanently upgrade them out of the Free Loader tier
        await supabaseAdmin.from('profiles').update({ 
          tier: 'The Artist' 
        }).eq('id', userId);

        await supabaseAdmin.from('transactions').insert({
          user_id: userId,
          amount: -(session.amount_total! / 100),
          type: 'UPSELL_PURCHASE',
          description: `Priority Bypass: Artist Node Activation`
        });
      }
      
      // 3. MASTERING TOKEN
      if (meta?.type === 'mastering_token') {
        await supabaseAdmin.from('profiles').update({ has_mastering_token: true }).eq('id', meta.userId || session.client_reference_id);
      }

      // 4. ENGINEERING TOKEN
      if (meta?.type === 'engineering_token') {
        await supabaseAdmin.from('profiles').update({ has_engineering_token: true }).eq('id', meta.userId || session.client_reference_id);
      }

      // 5. CREDIT TOP-UP (50 CRD Pack)
      if (meta?.type === 'credit_topup') {
        const userId = meta.userId || session.client_reference_id;
        const { data: profile } = await supabaseAdmin.from('profiles').select('credits').eq('id', userId).single();
        const currentCredits = profile?.credits || 0;
        const addedCredits = parseInt(meta.credit_amount || '50', 10);
        
        await supabaseAdmin.from('profiles').update({ credits: currentCredits + addedCredits }).eq('id', userId);
      }

      // 6. SYNDICATE ESCROW CONTRACT (Room 10 Booking/Feature)
      if (meta?.type === 'escrow_contract') {
        // Create the escrow lock in the database
        await supabaseAdmin.from('escrow_contracts').insert({
          buyer_id: meta.buyerId,
          artist_id: meta.targetNodeId,
          amount: (session.amount_total! / 100),
          status: 'funded',
          interaction_type: meta.interactionType || 'feature',
          stripe_session_id: session.id
        });
        
        // Log transaction for the buyer in Room 08
        await supabaseAdmin.from('transactions').insert({
           user_id: meta.buyerId,
           amount: -(session.amount_total! / 100),
           type: 'ESCROW_LOCK',
           description: `Escrow Funded for Node: ${meta.targetNodeId.substring(0,8)}`
        });
      }
    }
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Webhook Logic Failure:", error.message);
    return NextResponse.json({ error: "Webhook Error" }, { status: 400 });
  }
}