export type PendingGuestClaim = { profileId: number; token: string };
export const PENDING_GUEST_CLAIM_KEY = "construcao-pending-guest-claim";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function readPendingGuestClaim(): PendingGuestClaim | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(localStorage.getItem(PENDING_GUEST_CLAIM_KEY) ?? "null") as PendingGuestClaim | null;
    return value && Number.isInteger(value.profileId) && value.profileId > 0 && UUID_PATTERN.test(value.token) ? value : null;
  } catch { return null; }
}

export function readPendingGuestClaimForProfile(profileId: number): PendingGuestClaim | null {
  const claim = readPendingGuestClaim();
  return claim?.profileId === profileId ? claim : null;
}
