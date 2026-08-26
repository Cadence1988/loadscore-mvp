import { useAuth } from "../auth/useAuth.js";

export default function AccountEntry() {
  const { isAuthenticated, isLoading } = useAuth();
  return (
    <nav className="account-entry" aria-label="LoadScore account">
      <a href="/account">{isLoading ? "Account" : isAuthenticated ? "Account" : "Sign in"}</a>
    </nav>
  );
}
