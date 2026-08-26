import { useState } from "react";
import { useAuth } from "../auth/useAuth.js";
import SignInForm from "../components/SignInForm.jsx";
import { trackEvent } from "../analytics/analytics.js";

export default function AccountPage() {
  const {
    user,
    isAuthenticated,
    isLoading,
    authError,
    authAvailable,
    configurationIssue,
    signOut,
  } = useAuth();
  const [signOutMessage, setSignOutMessage] = useState("");

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
            <p>This account is authentication only. No subscription, billing, Pro status, or cloud freight sync exists yet.</p>
            <button className="auth-secondary" type="button" onClick={handleSignOut}>Sign out</button>
          </div>
        )}

        {(authError || signOutMessage) && <p className="auth-message error" role="alert">{signOutMessage || authError}</p>}
      </section>
    </main>
  );
}
