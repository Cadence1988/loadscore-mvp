import Stripe from "stripe";
import { readServerBillingConfig, STRIPE_API_VERSION } from "../_lib/billingConfig.js";
import { readRawBody, sendJson } from "../_lib/http.js";
import { createSupabaseAdmin } from "../_lib/supabaseAdmin.js";
import { createSubscriptionRepository } from "../_lib/subscriptionRepository.js";
import {
  HANDLED_EVENTS,
  safePlan,
  subscriptionIdFromEvent,
  toSubscriptionRecord,
} from "../_lib/subscriptionState.js";

export const config = { api: { bodyParser: false } };

function customerId(subscription) {
  return typeof subscription?.customer === "string" ? subscription.customer : subscription?.customer?.id;
}

export function createWebhookHandler({ webhookSecret, stripe, repository, constructEvent }) {
  return async function webhookHandler(request, response) {
    if (request.method !== "POST") return sendJson(response, 405, { error: "method_not_allowed" });
    let event;
    try {
      const rawBody = await readRawBody(request);
      const signature = request.headers?.["stripe-signature"];
      if (!signature || !webhookSecret) throw new Error("invalid_signature");
      event = constructEvent(rawBody, signature, webhookSecret);
    } catch {
      return sendJson(response, 400, { error: "invalid_signature" });
    }

    let claimed = false;
    try {
      const claim = await repository.claimEvent(event);
      if (claim === "duplicate" || claim === "in_progress") {
        return sendJson(response, 200, { received: true, duplicate: true });
      }
      claimed = true;
      if (!HANDLED_EVENTS.has(event.type)) {
        await repository.finishEvent(event.id, "ignored");
        return sendJson(response, 200, { received: true });
      }

      const eventObject = event.data?.object;
      let subscription;
      if (event.type === "customer.subscription.deleted") {
        subscription = eventObject;
      } else {
        const subscriptionId = subscriptionIdFromEvent(event);
        if (!subscriptionId) {
          await repository.finishEvent(event.id, "ignored", "subscription_id_missing");
          return sendJson(response, 200, { received: true });
        }
        subscription = await stripe.subscriptions.retrieve(subscriptionId);
      }

      const plan = safePlan(subscription?.metadata?.loadscore_plan);
      const metadataUserId = subscription?.metadata?.loadscore_user_id || null;
      if (!plan) {
        await repository.finishEvent(event.id, "ignored", "plan_mapping_missing");
        return sendJson(response, 200, { received: true });
      }
      const userId = await repository.findUserForStripe({
        userId: metadataUserId,
        customerId: customerId(subscription),
        subscriptionId: subscription?.id,
      });
      if (!userId) {
        await repository.finishEvent(event.id, "ignored", "user_mapping_missing");
        return sendJson(response, 200, { received: true });
      }

      const outcome = await repository.applySubscription(
        userId,
        toSubscriptionRecord(subscription, plan, event.created),
        event.id,
      );
      await repository.finishEvent(event.id, outcome === "older_event" ? "ignored" : "succeeded");
      return sendJson(response, 200, { received: true });
    } catch {
      if (claimed && event?.id) {
        try { await repository.finishEvent(event.id, "failed", "transient_processing_failure"); } catch { /* Stripe retry remains authoritative. */ }
      }
      return sendJson(response, 500, { error: "webhook_processing_failed" });
    }
  };
}

export default async function handler(request, response) {
  let serverConfig;
  try {
    serverConfig = readServerBillingConfig();
    if (!serverConfig.webhookSecret.startsWith("whsec_")) throw new Error("webhook_secret_required");
  } catch {
    return sendJson(response, 503, { error: "billing_test_mode_not_configured" });
  }
  const stripe = new Stripe(serverConfig.stripeSecretKey, { apiVersion: STRIPE_API_VERSION });
  const admin = createSupabaseAdmin(serverConfig);
  return createWebhookHandler({
    webhookSecret: serverConfig.webhookSecret,
    stripe,
    repository: createSubscriptionRepository(admin),
    constructEvent: (body, signature, secret) => stripe.webhooks.constructEvent(body, signature, secret),
  })(request, response);
}
