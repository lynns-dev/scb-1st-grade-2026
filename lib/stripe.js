import Stripe from "stripe";

let client = null;

// Lazily constructed so the app doesn't crash at build/import time if the
// key isn't set yet — routes that need it check isStripeConfigured() first
// and return a clear error instead of a stack trace.
export function getStripe() {
  if (client) return client;
  if (!process.env.STRIPE_SECRET_KEY) return null;
  client = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
  return client;
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

// The app's cut, on top of Stripe's own processing cost — stacked via
// Stripe Connect's application_fee_amount, paid straight to this app's own
// Stripe balance, never touching the classroom's payout account. Flat
// percentage for now; easy to make this configurable later if needed.
export const PLATFORM_FEE_PERCENT = 1;

export function platformFeeCents(amountCents) {
  return Math.round(amountCents * (PLATFORM_FEE_PERCENT / 100));
}
