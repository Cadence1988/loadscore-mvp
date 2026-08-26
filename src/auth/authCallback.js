const ALLOWED_EMAIL_TYPES = new Set(["email", "magiclink"]);

function hasProviderError(parsed) {
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  return Boolean(
    parsed.searchParams.get("error")
      || parsed.searchParams.get("error_code")
      || hash.get("error")
      || hash.get("error_code"),
  );
}

async function existingSession(client) {
  try {
    const { data } = await client.auth.getSession();
    return data?.session || null;
  } catch {
    return null;
  }
}

export async function completeAuthCallback(client, callbackUrl) {
  if (!client) return { ok: false, reason: "unconfigured" };

  let parsed;
  try {
    parsed = new URL(callbackUrl);
  } catch {
    return { ok: false, reason: "invalid_callback" };
  }

  if (hasProviderError(parsed)) {
    if (await existingSession(client)) return { ok: true, alreadyAuthenticated: true };
    return { ok: false, reason: "provider_error" };
  }

  const tokenHash = parsed.searchParams.get("token_hash");
  const type = parsed.searchParams.get("type") || "email";
  const code = parsed.searchParams.get("code");

  let error;
  if (tokenHash && ALLOWED_EMAIL_TYPES.has(type)) {
    ({ error } = await client.auth.verifyOtp({ token_hash: tokenHash, type }));
  } else if (code) {
    ({ error } = await client.auth.exchangeCodeForSession(code));
  } else if (await existingSession(client)) {
    return { ok: true, alreadyAuthenticated: true };
  } else {
    return { ok: false, reason: "missing_credentials" };
  }

  if (error) {
    if (await existingSession(client)) return { ok: true, alreadyAuthenticated: true };
    return { ok: false, reason: "verification_failed" };
  }

  return { ok: true, alreadyAuthenticated: false };
}
