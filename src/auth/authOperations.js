import { callbackUrlFor, isValidEmail, normalizeEmail } from "./authConfig.js";

export async function requestMagicLink(client, email, locationLike = globalThis.location) {
  if (!client) return { ok: false, reason: "unconfigured" };
  if (!isValidEmail(email)) return { ok: false, reason: "invalid_email" };

  try {
    const { error } = await client.auth.signInWithOtp({
      email: normalizeEmail(email),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: callbackUrlFor(locationLike),
      },
    });
    return error ? { ok: false, reason: "request_failed" } : { ok: true };
  } catch {
    return { ok: false, reason: "request_failed" };
  }
}

export async function endAuthSession(client) {
  if (!client) return { ok: true };
  try {
    const { error } = await client.auth.signOut();
    return error ? { ok: false, reason: "signout_failed" } : { ok: true };
  } catch {
    return { ok: false, reason: "signout_failed" };
  }
}
