export const ONBOARDING_KEY = "loadscore-onboarding-v1";
export function readOnboardingState(storage) {
  try { return JSON.parse(storage?.getItem(ONBOARDING_KEY) || "null") || { status: "new" }; }
  catch { return { status: "new" }; }
}
export function saveOnboardingState(storage, status) {
  const value = { status, updatedAt: new Date().toISOString() };
  storage?.setItem(ONBOARDING_KEY, JSON.stringify(value));
  return value;
}
export function shouldShowOnboarding(storage) { return readOnboardingState(storage).status === "new"; }
