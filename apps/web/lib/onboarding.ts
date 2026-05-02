export const ONBOARDED_KEY = "obscura:onboarded";

export const LAST_ROLE_KEY = "obscura:last-role";

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
