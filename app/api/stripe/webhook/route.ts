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

      if (meta?.type === 'exec_rollout') {
        
        // 1. Fetch current data to apply the math
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
        
        // 2. THE MATH: Base Score + Penalty Difference = 95
        if (sub && sub.hit_score < 95) {
          updatePayload.base_hit_score = sub.base_hit_score || sub.hit_score; // Save the real score
          updatePayload.hit_score = 95; // Force the public ego boost to 95
        }

        // 3. Update the Ledger
        await supabaseAdmin.from('submissions').update(updatePayload).eq('id', meta.track_id);
        
        // 4. Log the transaction for Room 08
        await supabaseAdmin.from('transactions').insert({
          user_id: meta.userId || session.client_reference_id,
          amount: -(session.amount_total! / 100),
          type: 'UPSELL_PURCHASE',
          description: `Independent Rollout Bypass: ${meta.track_id}`
        });
      }
      
      // Standard tokens...
      if (meta?.type === 'mastering_token') {
        await supabaseAdmin.from('profiles').update({ has_mastering_token: true }).eq('id', meta.userId || session.client_reference_id);
      }
    }
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Webhook Logic Failure:", error.message);
    return NextResponse.json({ error: "Webhook Error" }, { status: 400 });
  }
}