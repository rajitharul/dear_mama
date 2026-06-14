// Supabase's PostgrestError isn't an `instanceof Error`, so `e.message` checks
// against Error swallow the real cause (e.g. "column ... does not exist"). This
// digs the human-readable message out of Errors, Postgrest errors, and plain
// objects alike, falling back to a friendly default.
export function errorMessage(e: unknown, fallback = 'Please try again.'): string {
  if (typeof e === 'string') return e || fallback;
  if (e && typeof e === 'object') {
    const o = e as { message?: unknown; details?: unknown; hint?: unknown };
    const parts = [o.message, o.details, o.hint].filter(
      (p): p is string => typeof p === 'string' && p.trim().length > 0,
    );
    if (parts.length) return parts.join(' — ');
  }
  return fallback;
}
