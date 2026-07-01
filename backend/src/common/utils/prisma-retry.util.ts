const TRANSIENT_PATTERNS = [
  'prepared statement',
  'connection terminated',
  "can't reach database",
  'econnreset',
  'client has already been released',
  'too many connections',
  'timeout',
  '42p05',
];

export function isTransientDbError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return TRANSIENT_PATTERNS.some((p) => msg.includes(p));
}

export async function withDbRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (!isTransientDbError(error) || i === attempts - 1) throw error;
      await new Promise((r) => setTimeout(r, 250 * 2 ** i));
    }
  }
  throw last;
}
