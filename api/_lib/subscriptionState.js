import { ALLOWED_PLANS } from "./billingConfig.js";

export const HANDLED_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

const STRIPE_STATUSES = new Set([
  "active", "trialing", "past_due", "unpaid", "canceled",
  "incomplete", "incomplete_expired", "paused",
]);

export function safePlan(value) {
  return ALLOWED_PLANS.includes(value) ? value : null;
}

export function normalizeStripeStatus(value) {
  return STRIPE_STATUSES.has(value) ? value : "inactive";
}

export function unixDate(value) {
  return Number.isFinite(value) && value > 0 ? new Date(value * 1000).toISOString() : null;
}

export function subscriptionPeriodEnd(subscription) {
  if (Number.isFinite(subscription?.current_period_end)) return subscription.current_period_end;
  const values = (subscription?.items?.data || [])
    .map((item) => item.current_period_end)
    .filter(Number.isFinite);
  return values.length ? Math.max(...values) : null;
}

export function toSubscriptionRecord(subscription, plan, eventCreated) {
  const status = normalizeStripeStatus(subscription?.status);
  const periodEnd = subscriptionPeriodEnd(subscription);
  return {
    plan,
    status,
    stripe_customer_id: typeof subscription?.customer === "string" ? subscription.customer : subscription?.customer?.id,
    stripe_subscription_id: subscription?.id,
    current_period_end: unixDate(periodEnd),
    cancel_at_period_end: Boolean(subscription?.cancel_at_period_end),
    grace_period_ends_at: status === "past_due" ? unixDate(eventCreated + (7 * 24 * 60 * 60)) : null,
    stripe_event_created_at: eventCreated,
  };
}

export function subscriptionIdFromEvent(event) {
  const object = event?.data?.object;
  if (event?.type === "checkout.session.completed") {
    return typeof object?.subscription === "string" ? object.subscription : object?.subscription?.id;
  }
  if (event?.type?.startsWith("customer.subscription.")) return object?.id;
  if (event?.type?.startsWith("invoice.")) {
    return typeof object?.subscription === "string"
      ? object.subscription
      : object?.subscription?.id
        || object?.parent?.subscription_details?.subscription;
  }
  return null;
}
