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
        // 1. Fetch the artifact to safely check its current score
        const { data: sub } = await supabaseAdmin
          .from('submissions')
          .select('hit_score, base_hit_score')
          .eq('id', meta.track_id)
          .single();
        
        let updatePayload: any = { rollout_purchased: true };
        
        // 2. THE EGO BOOST (PAYOLA MECHANIC)
        // If they scored under 95, save their real score and boost them to 95!
        if (sub && sub.hit_score < 95) {
          updatePayload.base_hit_score = sub.base_hit_score || sub.hit_score;
          updatePayload.hit_score = 95;
        }

        // 3. Apply the update to the Database
        await supabaseAdmin.from('submissions').update(updatePayload).eq('id', meta.track_id);
        
        // 4. Log the transaction
        await supabaseAdmin.from('transactions').insert({
          user_id: meta.userId,
          amount: -(session.amount_total! / 100),
          type: 'UPSELL_PURCHASE',
          description: `Independent Rollout: ${meta.track_id}`
        });
      }
      
      // Standard token/tier handling...
      if (meta?.type === 'mastering_token') {
        await supabaseAdmin.from('profiles').update({ has_mastering_token: true }).eq('id', meta.userId);
      }
    }
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Webhook Logic Failure:", error.message);
    return NextResponse.json({ error: "Webhook Error" }, { status: 400 });
  }
}