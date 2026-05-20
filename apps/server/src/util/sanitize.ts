// Player-supplied nickname → safe display string.
//
// Threat model: nickname is rendered in HUD and lobby list (and possibly
// later in chat). We must prevent XSS via embedded HTML/script, control
// characters that mess up terminals, and crazy-long strings that blow up
// the UI layout. We keep Unicode letters and digits (so non-ASCII names like
// "Cláudia" or "日本" still work), plus a short whitelist of punctuation.
//
// Steps:
//   1. Bounded slice (256) so a malicious 10 MB nickname never reaches the
//      regex engine. Cheap O(1) guard regardless of payload size.
//   2. Trim outer whitespace.
//   3. Strip everything that isn't an allowed code point.
//   4. Final slice to display length (16). Empty result → fallback.
const HARD_LIMIT = 256;
const DISPLAY_LIMIT = 16;
const ALLOWED = /[^\p{L}\p{N} _-]/gu;

export function sanitizeName(raw: unknown, fallback = 'guest'): string {
  if (typeof raw !== 'string') return fallback;
  const bounded = raw.length > HARD_LIMIT ? raw.slice(0, HARD_LIMIT) : raw;
  const cleaned = bounded.trim().replace(ALLOWED, '').slice(0, DISPLAY_LIMIT);
  return cleaned.length > 0 ? cleaned : fallback;
}
