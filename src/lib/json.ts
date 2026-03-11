export function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function safeJsonStringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
