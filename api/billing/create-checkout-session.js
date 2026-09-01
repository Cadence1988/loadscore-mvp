import Stripe from "stripe";
import { priceForPlan, readServerBillingConfig, STRIPE_API_VERSION } from "../_lib/billingConfig.js";
import { bearerToken, readJsonBody, sendJson } from "../_lib/http.js";
import { authenticateUser, createSupabaseAdmin } from "../_lib/supabaseAdmin.js";
import { createSubscriptionRepository } from "../_lib/subscriptionRepository.js";

const ACCEPTED_BODY_KEYS = new Set(["plan"]);

export function createCheckoutHandler({ config, stripe, authenticate, repository }) {
  return async function checkoutHandler(request, response) {
    if (request.method !== "POST") return sendJson(response, 405, { error: "method_not_allowed" });

    try {
      const user = await authenticate(bearerToken(request));
      if (!user?.id) return sendJson(response, 401, { error: "authentication_required" });

      const body = await readJsonBody(request);
      if (!body || Array.isArray(body) || Object.keys(body).some((key) => !ACCEPTED_BODY_KEYS.has(key))) {
        return sendJson(response, 400, { error: "invalid_request" });
      }
      const plan = body.plan;
      const price = priceForPlan(config, plan);
      const existing = await repository.findByUser(user.id);
      if (!existing) return sendJson(response, 409, { error: "account_database_not_ready" });

      let customerId = existing.stripe_customer_id;
      if (!customerId) {
        const created = await stripe.customers.create({
          metadata: { loadscore_user_id: user.id },
        });
        const attached = await repository.attachCustomer(user.id, created.id);
        if (attached?.stripe_customer_id) {
          customerId = attached.stripe_customer_id;
        } else {
          const winner = await repository.findByUser(user.id);
          customerId = winner?.stripe_customer_id;
          if (customerId && customerId !== created.id) await stripe.customers.del(created.id);
        }
      }
      if (!customerId) throw new Error("customer_mapping_failed");

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price, quantity: 1 }],
        success_url: `${config.siteUrl}/checkout/success`,
        cancel_url: `${config.siteUrl}/account?checkout=canceled`,
        client_reference_id: user.id,
        metadata: {
          loadscore_user_id: user.id,
          loadscore_plan: plan,
        },
        subscription_data: {
          metadata: {
            loadscore_user_id: user.id,
            loadscore_plan: plan,
          },
        },
      });
      if (!session?.url) throw new Error("checkout_url_missing");
      return sendJson(response, 200, { url: session.url });
    } catch (error) {
      const code = ["invalid_plan", "plan_not_configured", "request_too_large"].includes(error?.message)
        ? error.message
        : "checkout_unavailable";
      return sendJson(response, code === "checkout_unavailable" ? 503 : 400, { error: code });
    }
  };
}

export default async function handler(request, response) {
  let config;
  try {
    config = readServerBillingConfig();
  } catch {
    return sendJson(response, 503, { error: "billing_test_mode_not_configured" });
  }
  const stripe = new Stripe(config.stripeSecretKey, { apiVersion: STRIPE_API_VERSION });
  const admin = createSupabaseAdmin(config);
  return createCheckoutHandler({
    config,
    stripe,
    authenticate: (token) => authenticateUser(admin, token),
    repository: createSubscriptionRepository(admin),
  })(request, response);
}
