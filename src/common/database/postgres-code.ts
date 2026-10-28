// Structured PostgreSQL SQLSTATE extraction for Prisma 7 adapter errors and native pg.
export function postgresCode(error: unknown, depth = 0): string | undefined {
  if (depth > 5 || typeof error !== 'object' || error === null) return;
  const value = error as Record<string, unknown>;
  for (const key of ['originalCode', 'code']) if (typeof value[key] === 'string' && /^(23P01|23514|23503|23505|22003|40001|40P01)$/.test(value[key])) return value[key];
  for (const key of ['meta', 'driverAdapterError', 'cause']) {
    const code = postgresCode(value[key], depth + 1);
    if (code) return code;
  }
}
