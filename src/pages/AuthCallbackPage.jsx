import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/useAuth.js";
import { trackEvent } from "../analytics/analytics.js";

export default function AuthCallbackPage() {
  const { authAvailable, isLoading, completeAuthCallback } = useAuth();
  const [status, setStatus] = useState("working");
  const started = useRef(false);

  useEffect(() => {
    if (isLoading || started.current) return;
    started.current = true;
    const callbackUrl = window.location.href;
    window.history.replaceState({}, document.title, "/auth/callback");

    if (!authAvailable) return;

    completeAuthCallback(callbackUrl)
      .then((result) => {
        if (!result.ok) {
          setStatus("error");
          return;
        }
        trackEvent("auth_completed", { surface: "web" });
        setStatus("success");
        window.setTimeout(() => window.location.replace("/account"), 250);
      })
      .catch(() => setStatus("error"));
  }, [authAvailable, completeAuthCallback, isLoading]);

  const displayStatus = !isLoading && !authAvailable && status === "working" ? "unavailable" : status;

  return (
    <main className="account-page">
      <section className="account-card auth-callback" aria-live="polite">
        <p className="eyebrow">LoadScore Account</p>
        {displayStatus === "working" && <><h1>Signing you in…</h1><p>Securely verifying your email link.</p></>}
        {displayStatus === "success" && <><h1>Signed in</h1><p>Opening your account.</p></>}
        {displayStatus === "unavailable" && <><h1>Account sign-in is unavailable</h1><p>Supabase configuration has not been added. Free LoadScore still works normally.</p><a href="/">Return to LoadScore</a></>}
        {displayStatus === "error" && <><h1>This sign-in link could not be verified</h1><p>It may be expired, already used, or opened in a different browser. Request a fresh link from the Account page.</p><a href="/account">Try again</a></>}
      </section>
    </main>
  );
}
