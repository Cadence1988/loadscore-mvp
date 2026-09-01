import { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth.js";
import SignInForm from "../components/SignInForm.jsx";
import { trackEvent } from "../analytics/analytics.js";
import { TEST_BILLING_PLANS } from "../billing/billingClient.js";

export default function AccountPage() {
  const {
    user,
    isAuthenticated,
    isLoading,
    authError,
    authAvailable,
    configurationIssue,
    signOut,
    loadAccountDatabase,
    startTestCheckout,
  } = useAuth();
  const [signOutMessage, setSignOutMessage] = useState("");
  const [database, setDatabase] = useState({ state: "idle" });
  const [checkoutState, setCheckoutState] = useState({ state: "idle", message: "" });

  useEffect(() => {
    let active = true;
    if (isLoading || !isAuthenticated) return () => { active = false; };
    loadAccountDatabase().then((result) => {
      if (active) setDatabase(result);
    });
    return () => { active = false; };
  }, [isAuthenticated, isLoading, loadAccountDatabase]);

  async function handleSignOut() {
    setSignOutMessage("");
    const result = await signOut();
    if (result.ok) {
      trackEvent("auth_signed_out", { surface: "web" });
      window.location.assign("/");
    } else {
      setSignOutMessage(result.message);
    }
  }

  async function handleCheckout(plan) {
    setCheckoutState({ state: "loading", message: "Opening secure Stripe test checkout…" });
    const result = await startTestCheckout(plan);
    if (result.ok) {
      window.location.assign(result.url);
      return;
    }
    const message = result.reason === "plan_not_configured" || result.reason === "billing_test_mode_not_configured"
      ? "Stripe test setup is not connected yet. Free LoadScore is unchanged."
      : "Test checkout is unavailable right now. Please try again later.";
    setCheckoutState({ state: "error", message });
  }

  return (
    <main className="account-page">
      <a className="back-link" href="/">← Back to LoadScore</a>
      <section className="account-card">
        <p className="eyebrow">Optional account</p>
        <h1>LoadScore Account</h1>
        <p className="account-intro">
          Your account will eventually manage Driver Pro access and account features.
          Your current freight, truck settings, profiles, comparisons, modes, and alerts remain stored locally.
        </p>

        {isLoading && <p role="status">Checking your account session…</p>}

        {!isLoading && !authAvailable && (
          <div className="account-unavailable" role="status">
            <strong>Account sign-in is not available yet.</strong>
            <p>Free LoadScore remains fully available without an account.</p>
            {import.meta.env.DEV && <small>Development configuration: {configurationIssue || "missing_configuration"}</small>}
          </div>
        )}

        {!isLoading && authAvailable && !isAuthenticated && <SignInForm />}

        {!isLoading && isAuthenticated && (
          <div className="account-identity">
            <span>Signed in as</span>
            <strong>{user?.email}</strong>
            <p>This account has a secure billing foundation in Stripe test mode. No live charges, paid feature gates, or cloud freight sync are enabled.</p>
            <div className={`account-database-status ${database.state}`} role="status">
              <span>Account database</span>
              {(database.state === "idle" || database.state === "loading") && <strong>Checking secure connection...</strong>}
              {database.state === "connected" && (
                <>
                  <strong>Connected</strong>
                  <small>Current account tier: {database.accountTier}. Safe subscription status: {database.subscriptionStatus}.</small>
                </>
              )}
              {database.state === "unavailable" && (
                <>
                  <strong>Setup pending</strong>
                  <small>Sign-in and Free LoadScore still work. No local freight data was uploaded.</small>
                </>
              )}
            </div>
            <section className="billing-test-panel" aria-labelledby="billing-test-title">
              <p className="eyebrow">Internal testing only</p>
              <h2 id="billing-test-title">Billing test mode</h2>
              <p>No live charges are enabled. Completing a Stripe test checkout does not unlock paid features.</p>
              <div className="billing-test-actions">
                {TEST_BILLING_PLANS.map((plan) => (
                  <button
                    className="auth-primary"
                    type="button"
                    key={plan.key}
                    disabled={checkoutState.state === "loading"}
                    onClick={() => handleCheckout(plan.key)}
                  >
                    {plan.label}
                  </button>
                ))}
              </div>
              {checkoutState.message && <p className={`auth-message ${checkoutState.state}`} role="status">{checkoutState.message}</p>}
            </section>
            <button className="auth-secondary" type="button" onClick={handleSignOut}>Sign out</button>
          </div>
        )}

        {(authError || signOutMessage) && <p className="auth-message error" role="alert">{signOutMessage || authError}</p>}
      </section>
    </main>
  );
}
