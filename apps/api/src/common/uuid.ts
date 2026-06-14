// Проверяем форму id, пришедшего от клиента, до того как он попадёт в uuid-колонку:
// мусорное значение даст чистый 4xx / "not found" вместо ошибки Postgres
// "invalid input syntax for type uuid" (которая дала бы 500).
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | undefined | null): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}
