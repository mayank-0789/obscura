// Shared constants for the onboarding + role-switcher flow. Kept in lib/ so
// the client components that read/write these stay in sync.

export const ONBOARDED_KEY = "payrail:onboarded";

// Persists which side of the rail a role='both' user last viewed, so refreshes
// and fresh logins land where they left off.
export const LAST_ROLE_KEY = "payrail:last-role";

export type Role = "user" | "merchant" | "both";
export type ActiveRole = "agent" | "merchant";

export function destinationForRole(role: Role): string {
  if (role === "merchant") return "/merchants/dashboard";
  if (role === "both") {
    const stored =
      typeof window !== "undefined"
        ? (localStorage.getItem(LAST_ROLE_KEY) as ActiveRole | null)
        : null;
    return stored === "merchant" ? "/merchants/dashboard" : "/dashboard";
  }
  return "/dashboard";
}

export function isDualRole(role: Role): boolean {
  return role === "both";
}
