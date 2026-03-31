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
  try {
    const { contractId, artistId, action } = await req.json();

    if (!contractId || !artistId || !action) {
      return NextResponse.json({ error: "Missing required parameters." }, { status: 400 });
    }

    // 1. Fetch the exact contract to verify ownership and status
    const { data: contract, error: fetchErr } = await supabaseAdmin
      .from('escrow_contracts')
      .select('*')
      .eq('id', contractId)
      .single();

    if (fetchErr || !contract) {
      return NextResponse.json({ error: "Contract not found." }, { status: 404 });
    }

    // Security Check: Only the targeted artist can respond!
    if (contract.artist_id !== artistId) {
      return NextResponse.json({ error: "Unauthorized node access." }, { status: 403 });
    }

    if (contract.status !== 'funded') {
      return NextResponse.json({ error: "Contract is no longer pending." }, { status: 400 });
    }

    // --- PATH A: ARTIST ACCEPTS ---
    if (action === 'accept') {
      await supabaseAdmin
        .from('escrow_contracts')
        .update({ status: 'accepted' })
        .eq('id', contractId);

      // Notify the Buyer
      await supabaseAdmin.from('notifications').insert({
        user_id: contract.user_id,
        type: 'escrow_accepted',
        title: 'CONTRACT ACCEPTED',
        message: `Your ${contract.interaction_type} request was accepted. The node is beginning work.`,
      });

      return NextResponse.json({ success: true, status: 'accepted' });
    }

    // --- PATH B: ARTIST DECLINES (TRIGGER STRIPE REFUND) ---
    if (action === 'decline') {
      if (!contract.stripe_session_id) {
        return NextResponse.json({ error: "Fatal: No Stripe session found for refund." }, { status: 500 });
      }

      // Retrieve the session to get the Payment Intent
      const session = await stripe.checkout.sessions.retrieve(contract.stripe_session_id);
      
      if (session.payment_intent) {
        // Issue the refund via Stripe
        await stripe.refunds.create({
          payment_intent: session.payment_intent as string,
        });
      }

      // Update Database
      await supabaseAdmin
        .from('escrow_contracts')
        .update({ status: 'declined_refunded' })
        .eq('id', contractId);

      // Notify the Buyer
      await supabaseAdmin.from('notifications').insert({
        user_id: contract.user_id,
        type: 'escrow_declined',
        title: 'CONTRACT DECLINED',
        message: `Your ${contract.interaction_type} request was declined. Funds have been returned to your card.`,
      });

      // Log the Refund in Transactions
      await supabaseAdmin.from('transactions').insert({
        user_id: contract.user_id,
        amount: contract.amount, // Positive amount to show refund
        type: 'ESCROW_REFUND',
        description: `Refund Processed: Node declined ${contract.interaction_type} contract.`
      });

      return NextResponse.json({ success: true, status: 'declined_refunded' });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });

  } catch (error: any) {
    console.error("[ESCROW RESPONSE API] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}