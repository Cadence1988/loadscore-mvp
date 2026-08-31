import { useCallback, useEffect, useMemo, useState } from "react";
import { readSupabaseConfig } from "./authConfig.js";
import { completeAuthCallback as verifyAuthCallback } from "./authCallback.js";
import { AuthContext } from "./authContextValue.js";
import { endAuthSession, requestMagicLink } from "./authOperations.js";
import { loadAccountDatabase as readAccountDatabase } from "../account/accountDatabase.js";

const GENERIC_REQUEST_ERROR = "We couldn't send a sign-in link. Please wait a moment and try again.";
const GENERIC_SIGNOUT_ERROR = "We couldn't finish signing out. Please try again.";
const runtimeConfiguration = readSupabaseConfig(import.meta.env);

export function AuthProvider({ children, client: providedClient = null, configuration = runtimeConfiguration }) {
  const [client, setClient] = useState(providedClient);
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(configuration.configured));
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let active = true;
    if (!configuration.configured || providedClient) return undefined;
    import("./supabaseClient.js")
      .then(({ supabaseClient }) => {
        if (active) setClient(supabaseClient);
      })
      .catch(() => {
        if (!active) return;
        setAuthError("Account session is unavailable. Free LoadScore is still ready.");
        setIsLoading(false);
      });
    return () => { active = false; };
  }, [configuration.configured, providedClient]);

  useEffect(() => {
    let active = true;
    if (!configuration.configured || !client) return undefined;

    client.auth.getSession()
      .then(({ data, error }) => {
        if (!active) return;
        setSession(error ? null : data?.session || null);
        setAuthError(error ? "Account session is unavailable. Free LoadScore is still ready." : "");
        setIsLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
        setAuthError("Account session is unavailable. Free LoadScore is still ready.");
        setIsLoading(false);
      });

    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession || null);
      setIsLoading(false);
      setAuthError("");
    });

    return () => {
      active = false;
      data?.subscription?.unsubscribe();
    };
  }, [client, configuration.configured]);

  const signInWithMagicLink = useCallback(async (email) => {
    setAuthError("");
    if (!configuration.configured || !client) {
      const message = "Account sign-in is not configured yet.";
      setAuthError(message);
      return { ok: false, reason: "unconfigured", message };
    }
    const result = await requestMagicLink(client, email, globalThis.location);
    if (result.reason === "invalid_email") {
      return { ...result, message: "Enter a valid email address." };
    }
    if (!result.ok) {
      setAuthError(GENERIC_REQUEST_ERROR);
      return { ...result, message: GENERIC_REQUEST_ERROR };
    }
    return result;
  }, [client, configuration.configured]);

  const signOut = useCallback(async () => {
    setAuthError("");
    if (!client) {
      setSession(null);
      return { ok: true };
    }
    const result = await endAuthSession(client);
    if (result.ok) {
      setSession(null);
      return result;
    }
    setAuthError(GENERIC_SIGNOUT_ERROR);
    return { ...result, message: GENERIC_SIGNOUT_ERROR };
  }, [client]);

  const completeAuthCallback = useCallback(
    (url) => verifyAuthCallback(client, url),
    [client],
  );

  const loadAccountDatabase = useCallback(
    () => readAccountDatabase(client),
    [client],
  );

  const value = useMemo(() => ({
    user: session?.user || null,
    isAuthenticated: Boolean(session?.user),
    isLoading,
    authError,
    authAvailable: Boolean(configuration.configured && client),
    configurationIssue: configuration.issue || "",
    signInWithMagicLink,
    signOut,
    completeAuthCallback,
    loadAccountDatabase,
  }), [
    authError,
    client,
    completeAuthCallback,
    configuration.configured,
    configuration.issue,
    isLoading,
    loadAccountDatabase,
    session,
    signInWithMagicLink,
    signOut,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
