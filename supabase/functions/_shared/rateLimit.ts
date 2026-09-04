// Per-instance sliding window limiter. Edge instances are ephemeral and there
// may be several of them, so this is a speed bump against credential stuffing
// rather than a hard guarantee; a shared store would be needed for that.
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  buckets.set(key, hits);

  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }

  return hits.length <= limit;
}

export function clientKey(req: Request, suffix: string): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  return `${ip}:${suffix}`;
}
