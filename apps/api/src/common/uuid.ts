// Shape-check a client-supplied id before it touches a uuid column, so a junk
// value yields a clean 4xx / "not found" instead of a Postgres "invalid input
// syntax for type uuid" error (a 500).
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | undefined | null): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}
