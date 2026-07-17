import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiError } from "@/lib/apiError";
import { getStripe, isStripeConfigured, platformFeeCents } from "@/lib/stripe";

const MAX_AMOUNT_DOLLARS = 2000;

export const POST = withApiError(async (request) => {
  const auth = await requireProfile();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Payments aren't set up for this app yet." },
      { status: 400 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_APP_URL isn't set" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const collectionId = body?.collectionId;
  const amount = Number(body?.amount);
  const note = body?.note?.trim() || null;

  if (!collectionId || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "A collection and a positive amount are required" }, { status: 400 });
  }
  if (amount > MAX_AMOUNT_DOLLARS) {
    return NextResponse.json(
      { error: `Gifts over $${MAX_AMOUNT_DOLLARS} aren't supported here — reach out directly for that.` },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: collection } = await admin
    .from("gift_collections")
    .select("id, title, closed_at, payout_account_id, payout_accounts ( stripe_account_id, payouts_enabled )")
    .eq("id", collectionId)
    .single();

  if (!collection) {
    return NextResponse.json({ error: "Gift collection not found" }, { status: 404 });
  }
  if (collection.closed_at) {
    return NextResponse.json({ error: "This gift collection is closed" }, { status: 400 });
  }
  if (!collection.payout_accounts?.payouts_enabled) {
    return NextResponse.json(
      { error: "This collection's payout account isn't ready yet" },
      { status: 400 }
    );
  }

  const amountCents = Math.round(amount * 100);
  const feeCents = platformFeeCents(amountCents);

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card", "us_bank_account"],
    customer_email: auth.profile.email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: { name: `Gift: ${collection.title}` },
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      application_fee_amount: feeCents,
      transfer_data: { destination: collection.payout_accounts.stripe_account_id },
    },
    success_url: `${appUrl}/gifts/${collectionId}?success=1`,
    cancel_url: `${appUrl}/gifts/${collectionId}`,
  });

  const { error } = await admin.from("gift_contributions").insert({
    collection_id: collectionId,
    contributor_id: auth.profile.id,
    amount_cents: amountCents,
    platform_fee_cents: feeCents,
    note,
    stripe_checkout_session_id: session.id,
    status: "pending",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ url: session.url });
});
