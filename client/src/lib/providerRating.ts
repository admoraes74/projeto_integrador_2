const RATING_VOTER_KEY = "construcao-rating-voter-id";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getRatingVoterId(): string {
  if (typeof window === "undefined") return crypto.randomUUID();
  try {
    const saved = localStorage.getItem(RATING_VOTER_KEY);
    if (saved && UUID_PATTERN.test(saved)) return saved;
    const generated = crypto.randomUUID();
    localStorage.setItem(RATING_VOTER_KEY, generated);
    return generated;
  } catch {
    return crypto.randomUUID();
  }
}
