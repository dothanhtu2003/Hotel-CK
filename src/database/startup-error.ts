// Classify driver/Prisma wrappers without logging their messages or credentials.
export function databaseStartupCategory(error: unknown): string {
  const pending: unknown[] = [error];
  const seen = new Set<object>();
  const codes = new Set<string>();
  let messages = '';
  while (pending.length && seen.size < 40) {
    const value = pending.shift();
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    for (const [key, entry] of Object.entries(value)) {
      if (['code', 'originalCode', 'sqlState'].includes(key) && typeof entry === 'string') codes.add(entry);
      if (entry && typeof entry === 'object') pending.push(entry);
    }
    if ('message' in value && typeof value.message === 'string') messages += ` ${value.message}`;
  }
  if (/tenant\/user .*not found|tenant or user not found/i.test(messages)) return 'POOLER_TENANT_NOT_FOUND';
  if ([...codes].some(code => /CERT|SELF_SIGNED|UNABLE_TO_VERIFY|ERR_TLS/.test(code))
    || /certificate|self.signed|unable to verify|hostname.*does not match/i.test(messages)) return 'TLS_CERTIFICATE';
  if (codes.has('28P01') || codes.has('P1000')) return 'AUTHENTICATION';
  if (codes.has('ENOTFOUND') || codes.has('EAI_AGAIN')) return 'DNS';
  if (codes.has('42501') || codes.has('P1010')) return 'PERMISSION';
  if (codes.has('42P01') || codes.has('3F000') || codes.has('P2021')) return 'SCHEMA_OR_TABLE_MISSING';
  if (codes.has('3D000')) return 'DATABASE_MISSING';
  if ([...codes].some(code => ['ETIMEDOUT', 'ECONNREFUSED', 'ENETUNREACH', 'EHOSTUNREACH', 'P1001', 'P1002'].includes(code))) return 'NETWORK';
  return 'UNKNOWN';
}
