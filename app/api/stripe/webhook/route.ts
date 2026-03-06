import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// We must use the SERVICE ROLE KEY here to securely bypass Row Level Security 
// and forcefully update the user's credits from the backend server.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature') as string;

  let event: Stripe.Event;

  try {
    // 1. Cryptographically verify the event actually came from Stripe
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error: any) {
    console.error(`Webhook signature verification failed: ${error.message}`);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // 2. Handle the specific event when a payment is successful
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    
    // Extract the custom metadata we passed during checkout
    const userId = session.metadata?.userId;
    const tier = session.metadata?.tier;

    if (userId && tier) {
      // Calculate how many credits they get
      const credits = tier === 'The Mogul' ? 999999 : tier === 'The Artist' ? 100 : 5;

      try {
        // 3. Upgrade their database profile!
        const { error } = await supabaseAdmin
          .from('profiles')
          .update({ 
            tier: tier, 
            credits: credits,
            stripe_customer_id: session.customer as string 
          })
          .eq('id', userId);

        if (error) throw error;
        
        console.log(`[STRIPE] Successfully upgraded User ${userId} to ${tier}`);
      } catch (dbError) {
        console.error("[SUPABASE] Failed to upgrade user:", dbError);
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
      }
    }
  }

  // 4. Return a 200 OK to Stripe so they know we got the message
  return NextResponse.json({ received: true }, { status: 200 });
}