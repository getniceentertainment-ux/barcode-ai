import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// Admin client to bypass RLS for fulfillment
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const body = await req.text();
  const headerList = await headers();
  // Ensure we catch the signature regardless of casing
  const signature = headerList.get('Stripe-Signature') || headerList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: "Missing Signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error(`Webhook Signature Error: ${err.message}`);
    return NextResponse.json({ error: "Webhook verification failed" }, { status: 400 });
  }

  // Handle Successful Payments
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    
    // Unified metadata extraction covering all Matrix gates
    const { userId, type, purchaseType, tier, credit_amount, beat_id } = session.metadata || {};
    
    // Fallback normalization for type parameter matching
    const fulfillmentType = type || purchaseType;

    if (!userId) {
      console.error("Webhook Error: No userId found in metadata.");
      return NextResponse.json({ error: "Missing Metadata" }, { status: 400 });
    }

    try {
      // --- 1. SUBSCRIPTION / TIER UPGRADE LOGIC ---
      if (tier) {
        // Moguls get infinite, Artists get 100, Free Loaders start with 5
        const initialCredits = tier === 'The Mogul' ? 999999 : tier === 'The Artist' ? 100 : 5;
        await supabaseAdmin
          .from('profiles')
          .update({ 
            tier: tier, 
            credits_remaining: initialCredits,
            stripe_customer_id: session.customer as string 
          })
          .eq('id', userId);
        console.log(`[STRIPE] Upgraded User ${userId} to ${tier}`);
      }

      // --- 2. MICRO-TRANSACTION / ITEM FULFILLMENT LOGIC ---
      if (fulfillmentType) {
        switch (fulfillmentType) {
          case 'engineering_token':
            await supabaseAdmin
              .from('profiles')
              .update({ has_engineering_token: true })
              .eq('id', userId);
            console.log(`[STRIPE] Engineering Suite unlocked for ${userId}`);
            break;

          case 'mastering_token':
            // Preserving your increment logic while adding the boolean flag required for Room 06
            const { data: profileT } = await supabaseAdmin
              .from('profiles')
              .select('mastering_tokens')
              .eq('id', userId)
              .single();
            
            await supabaseAdmin
              .from('profiles')
              .update({ 
                mastering_tokens: (profileT?.mastering_tokens || 0) + 1,
                has_mastering_token: true 
              })
              .eq('id', userId);
            console.log(`[STRIPE] Mastering Token unlocked for ${userId}`);
            break;

          case 'credit_topup':
            // Gracefully handles both possible column names for credit tracking
            const { data: profileC } = await supabaseAdmin
              .from('profiles')
              .select('credits, credits_remaining') 
              .eq('id', userId)
              .single();
              
            const amount = parseInt(credit_amount || '50');
            await supabaseAdmin
              .from('profiles')
              .update({ 
                credits: (profileC?.credits || 0) + amount,
                credits_remaining: (profileC?.credits_remaining || 0) + amount
              })
              .eq('id', userId);
            console.log(`[STRIPE] Added ${amount} credits for ${userId}`);
            break;

          case 'beat_lease':
            await supabaseAdmin.from('purchases').insert({
              user_id: userId,
              item_type: 'beat',
              item_id: beat_id,
              amount_paid: session.amount_total ? session.amount_total / 100 : 0
            });
            console.log(`[STRIPE] Beat ${beat_id} leased by ${userId}`);
            break;

          default:
            console.warn("Unrecognized fulfillment type:", fulfillmentType);
        }
      }
    } catch (dbErr: any) {
      console.error("Fulfillment Database Error:", dbErr.message);
      return NextResponse.json({ error: "Database sync failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}