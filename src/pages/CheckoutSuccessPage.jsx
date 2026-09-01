import { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth.js";

export default function CheckoutSuccessPage() {
  const { isAuthenticated, isLoading, loadAccountDatabase } = useAuth();
  const [database, setDatabase] = useState({ state: "idle" });

  useEffect(() => {
    let active = true;
    if (isLoading || !isAuthenticated) return () => { active = false; };
    loadAccountDatabase().then((result) => { if (active) setDatabase(result); });
    return () => { active = false; };
  }, [isAuthenticated, isLoading, loadAccountDatabase]);

  return (
    <main className="account-page">
      <section className="account-card checkout-success" aria-live="polite">
        <p className="eyebrow">Stripe test mode</p>
        <h1>Payment submitted</h1>
        <p>We’re confirming your test subscription through secure Stripe webhook processing.</p>
        <p>This page does not activate Driver Pro. The verified server record is the only billing authority, and no live charges are enabled.</p>
        {database.state === "connected" && (
          <div className="account-database-status connected">
            <span>Safe account status</span>
            <strong>{database.accountTier}</strong>
            <small>Subscription status: {database.subscriptionStatus}</small>
          </div>
        )}
        <div className="account-actions">
          <a className="auth-primary" href="/account">Return to account</a>
          <a className="auth-secondary" href="/">Open LoadScore</a>
        </div>
      </section>
    </main>
  );
}
