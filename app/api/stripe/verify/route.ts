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

    const userId = session.metadata?.userId || session.client_reference_id;
    if (!userId) throw new Error("Missing user ID in session metadata");

    // 2. Fetch current submission data
    const { data: sub } = await supabaseAdmin
      .from('submissions')
      .select('hit_score, exec_bypass')
      .eq('id', trackId)
      .single();

    // Race Condition Guard
    if (sub?.exec_bypass) {
       return NextResponse.json({ success: true, message: "Already verified." });
    }

    // 3. THE PRO-RATED ALGORITHMIC MATCH MATH
    const score = sub?.hit_score || 0;
    const proRatedAdvance = Math.floor(1500 * (score / 100));

    // 4. Fetch user's current marketing credits
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('marketing_credits')
      .eq('id', userId)
      .single();
      
    const currentCredits = profile?.marketing_credits || 0;

    // 5. Deposit the Pro-Rated Advance into their profile
    await supabaseAdmin
      .from('profiles')
      .update({ marketing_credits: currentCredits + proRatedAdvance })
      .eq('id', userId);

    // 6. Unlock the submission (Trump Card)
    await supabaseAdmin
      .from('submissions')
      .update({ 
        exec_bypass: true, 
        rollout_purchased: true,
        campaign_day: 1 
      })
      .eq('id', trackId);
    
    // 7. Log the transactions for Room 08 Ledger
    await supabaseAdmin.from('transactions').insert([
      {
        user_id: userId,
        amount: -(session.amount_total! / 100),
        type: 'UPSELL_PURCHASE',
        description: `Algorithmic SaaS Purchase: ${trackId}`
      },
      {
        user_id: userId,
        amount: proRatedAdvance,
        type: 'ADVANCE_DEPOSIT',
        description: `Pro-Rated Algorithmic Match (${score}% of $1,500)`
      }
    ]);

    return NextResponse.json({ success: true, advance: proRatedAdvance });
  } catch (error: any) {
    console.error("Session Verification Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}