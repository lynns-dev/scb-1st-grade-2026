import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiError } from "@/lib/apiError";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { sendPushToUsers } from "@/lib/pushNotify";

// Stripe calls this directly — no user session, so it's public (see
// middleware.js) and instead trusts Stripe's own signature on the raw body.
// A successful redirect back to /gifts/[id] is never itself treated as
// proof of payment (see app/api/gifts/checkout) — this webhook is the only
// thing that ever marks a contribution "succeeded". Bank-account (ACH)
// gifts don't clear instantly, so this listens for both the immediate
// card-payment path (checkout.session.completed) and the delayed ACH
// settlement path (async_payment_succeeded / async_payment_failed).
export const POST = withApiError(async (request) => {
  if (!isStripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return NextResponse.json({ error: `Invalid signature: ${err.message}` }, { status: 400 });
  }

  const admin = createAdminClient();

  async function markContribution(sessionId, status, paymentIntentId) {
    const { data } = await admin
      .from("gift_contributions")
      .update({ status, stripe_payment_intent_id: paymentIntentId || null })
      .eq("stripe_checkout_session_id", sessionId)
      .select("id, amount_cents, note, collection_id, gift_collections ( title, created_by )")
      .maybeSingle();

    if (status === "succeeded" && data?.gift_collections?.created_by) {
      try {
        await sendPushToUsers(
          [data.gift_collections.created_by],
          {
            title: "New gift received",
            body: `$${(data.amount_cents / 100).toFixed(2)} toward "${data.gift_collections.title}"`,
            url: `/gifts/${data.collection_id}`,
          },
          {}
        );
      } catch {
        // Best-effort — the contribution itself already recorded.
      }
    }
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.payment_status === "paid") {
        await markContribution(session.id, "succeeded", session.payment_intent);
      }
      break;
    }
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      await markContribution(session.id, "succeeded", session.payment_intent);
      break;
    }
    case "checkout.session.async_payment_failed": {
      const session = event.data.object;
      await markContribution(session.id, "failed", session.payment_intent);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
});
