/**
 * Auth state management - simple localStorage-based auth.
 */

import { getToken, removeToken } from "./api";

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return !!getToken();
}

export function logout(): void {
  removeToken();
  window.location.href = "/login";
}
