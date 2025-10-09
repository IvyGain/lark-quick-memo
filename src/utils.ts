export function decorateWithTimestamp(text: string, enabled: boolean): string {
  if (!enabled) return text;
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  return `[${stamp}] ${text}`;
}

export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseMs?: number } = {}
): Promise<T> {
  const retries = opts.retries ?? 1;
  const baseMs = opts.baseMs ?? 500;
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (e: any) {
      if (attempt >= retries) throw e;
      const delay = baseMs * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
      attempt++;
    }
  }
}
