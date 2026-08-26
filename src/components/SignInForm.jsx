import { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth.js";
import { isValidEmail } from "../auth/authConfig.js";
import { trackEvent } from "../analytics/analytics.js";

export default function SignInForm() {
  const { signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    trackEvent("account_signin_viewed", { surface: "web" });
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (status === "pending") return;
    if (!isValidEmail(email)) {
      setStatus("error");
      setMessage("Enter a valid email address.");
      return;
    }

    setStatus("pending");
    setMessage("");
    const result = await signInWithMagicLink(email);
    if (result.ok) {
      setStatus("success");
      setMessage("Check your email for your LoadScore sign-in link.");
      trackEvent("magic_link_requested", { surface: "web" });
      return;
    }
    setStatus("error");
    setMessage(result.message || "We couldn't send a sign-in link. Please try again.");
  }

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      <label htmlFor="account-email">
        Email address
        <input
          id="account-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={status === "error" && !isValidEmail(email)}
          disabled={status === "pending" || status === "success"}
          required
        />
      </label>
      <button className="auth-primary" type="submit" disabled={status === "pending" || status === "success"}>
        {status === "pending" ? "Sending secure link…" : status === "success" ? "Link sent" : "Email me a sign-in link"}
      </button>
      {message && <p className={`auth-message ${status}`} role={status === "error" ? "alert" : "status"}>{message}</p>}
      <small>No password is needed. The link is time-limited and can be used only for account access.</small>
    </form>
  );
}
