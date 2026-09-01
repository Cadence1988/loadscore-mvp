const ALLOWED_TEST_PLANS = new Set(["founding_driver_pro", "driver_pro"]);

export async function createTestCheckout(client, plan, fetcher = globalThis.fetch) {
  if (!client || !ALLOWED_TEST_PLANS.has(plan)) return { ok: false, reason: "invalid_request" };
  try {
    const { data, error } = await client.auth.getSession();
    const token = data?.session?.access_token;
    if (error || !token) return { ok: false, reason: "authentication_required" };
    const response = await fetcher("/api/billing/create-checkout-session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ plan }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.url) return { ok: false, reason: body.error || "checkout_unavailable" };
    return { ok: true, url: body.url };
  } catch {
    return { ok: false, reason: "checkout_unavailable" };
  }
}

export const TEST_BILLING_PLANS = Object.freeze([
  { key: "driver_pro", label: "Driver Pro test plan" },
  { key: "founding_driver_pro", label: "Founding Driver Pro test plan (internal only)" },
]);
