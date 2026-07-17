import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiError } from "@/lib/apiError";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

// Starts (or restarts, for a new payout recipient) Stripe Express
// onboarding. Always creates a fresh Express account — reassigning the
// recipient each year/occasion is expected, not an edge case, so this
// deliberately doesn't try to reuse a prior account. Only requests the
// `transfers` capability (not card_payments), since the connected account
// never processes its own charges — this app collects via Checkout on the
// platform side and transfers the net amount out, which keeps Stripe's
// onboarding form for the room parent/teacher as light as it can be.
export const POST = withApiError(async () => {
  const auth = await requireAdmin();
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
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL isn't set — Stripe needs it for the onboarding redirect." },
      { status: 500 }
    );
  }

  const stripe = getStripe();
  const account = await stripe.accounts.create({
    type: "express",
    business_type: "individual",
    capabilities: { transfers: { requested: true } },
    metadata: { app: "the-village", connected_by: auth.profile.id },
  });

  const admin = createAdminClient();
  const { error } = await admin.from("payout_accounts").insert({
    stripe_account_id: account.id,
    connected_by: auth.profile.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${appUrl}/admin?gifts=refresh`,
    return_url: `${appUrl}/admin?gifts=return`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: accountLink.url });
});
