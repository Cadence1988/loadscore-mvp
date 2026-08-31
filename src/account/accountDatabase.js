const PROFILE_COLUMNS = "user_id,display_name,created_at,updated_at";
const SUBSCRIPTION_COLUMNS = "plan,status,current_period_end,cancel_at_period_end,grace_period_ends_at,created_at,updated_at";

function safeResult(result) {
  if (!result || result.error || !result.data) return null;
  return result.data;
}

export async function loadAccountDatabase(client) {
  if (!client) return { state: "unavailable" };

  try {
    const [profileResult, subscriptionResult] = await Promise.all([
      client.from("user_profiles").select(PROFILE_COLUMNS).maybeSingle(),
      client.from("subscriptions").select(SUBSCRIPTION_COLUMNS).maybeSingle(),
    ]);
    const profile = safeResult(profileResult);
    const subscription = safeResult(subscriptionResult);
    if (!profile || !subscription) return { state: "unavailable" };
    return {
      state: "connected",
      profile: {
        displayName: profile.display_name || "",
        createdAt: profile.created_at || null,
      },
      accountTier: subscription.plan === "free" ? "Free" : "Unavailable",
      billingEnabled: false,
    };
  } catch {
    return { state: "unavailable" };
  }
}

export const ACCOUNT_DATABASE_TABLES = Object.freeze(["user_profiles", "subscriptions"]);
