import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  try {
    const { sessionId, trackId } = await req.json();

    // 1. Verify payment directly with Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return NextResponse.json({ error: "Payment not finalized." }, { status: 400 });
    }

    // 2. Safely fetch current data
    const { data: sub } = await supabaseAdmin
      .from('submissions')
      .select('hit_score, base_hit_score, exec_bypass')
      .eq('id', trackId)
      .single();

    // 3. Race Condition Guard: If webhook somehow beat us here, do nothing
    if (sub?.exec_bypass) {
       return NextResponse.json({ success: true, message: "Already verified." });
    }

    // 4. THE PAYOLA MATH (Instant Execution)
    let updatePayload: any = { 
      exec_bypass: true, 
      campaign_day: 1,   
      exec_rollout: "AWAITING_NEURAL_SYNTHESIS" 
    };
    
    if (sub && sub.hit_score < 95) {
      updatePayload.base_hit_score = sub.base_hit_score || sub.hit_score;
      updatePayload.hit_score = 95;
    }

    await supabaseAdmin.from('submissions').update(updatePayload).eq('id', trackId);
    
    // 5. Log the transaction
    await supabaseAdmin.from('transactions').insert({
      user_id: session.metadata?.userId || session.client_reference_id,
      amount: -(session.amount_total! / 100),
      type: 'UPSELL_PURCHASE',
      description: `Independent Rollout Bypass: ${trackId}`
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Session Verification Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}