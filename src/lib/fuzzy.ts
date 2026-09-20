/** Subsequence fuzzy matcher used by the command palette.
 * Returns -1 for no match, otherwise a score where lower is better
 * (sum of gaps between matched characters). */
export function fuzzy(query: string, target: string): number {
  const q = query.toLowerCase();
  const s = target.toLowerCase();
  let i = 0;
  let score = 0;
  for (const ch of q) {
    const idx = s.indexOf(ch, i);
    if (idx < 0) return -1;
    score += idx - i;
    i = idx + 1;
  }
  return score;
}

export interface Ranked<T> {
  item: T;
  score: number;
}

export function rank<T>(query: string, items: T[], label: (t: T) => string, limit = 9): T[] {
  const q = query.trim();
  const scored: Ranked<T>[] = [];
  for (const item of items) {
    const score = q ? fuzzy(q, label(item)) : 0;
    if (score >= 0) scored.push({ item, score });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map((r) => r.item);
}
