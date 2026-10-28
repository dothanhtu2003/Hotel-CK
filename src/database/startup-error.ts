// Classify driver/Prisma wrappers without logging their messages or credentials.
export function databaseStartupCategory(error: unknown): string {
  const pending: unknown[] = [error];
  const seen = new Set<object>();
  const codes = new Set<string>();
  const kinds = new Set<string>();
  let messages = '';
  while (pending.length && seen.size < 40) {
    const value = pending.shift();
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    for (const [key, entry] of Object.entries(value)) {
      if (['code', 'originalCode', 'sqlState'].includes(key) && typeof entry === 'string') codes.add(entry);
      if (key === 'kind' && typeof entry === 'string') kinds.add(entry);
      if (key === 'originalMessage' && typeof entry === 'string') messages += ` ${entry}`;
      if (entry && typeof entry === 'object') pending.push(entry);
    }
    if ('message' in value && typeof value.message === 'string') messages += ` ${value.message}`;
  }
  if (codes.has('ENOENT') || /ENOENT|no such file or directory/i.test(messages)) return 'CERTIFICATE_FILE_MISSING';
  if (codes.has('EACCES') || /EACCES|permission denied.*(?:open|file)/i.test(messages)) return 'CERTIFICATE_FILE_UNREADABLE';
  if (/no start line|bad base64|PEM routines/i.test(messages)) return 'CERTIFICATE_FILE_INVALID';
  if (/tenant\/user .*not found|tenant or user not found/i.test(messages)) return 'POOLER_TENANT_NOT_FOUND';
  if (/unsupported startup parameter.*options/i.test(messages)) return 'POOLER_STARTUP_OPTIONS';
  if (kinds.has('AuthenticationFailed')) return 'AUTHENTICATION';
  if (kinds.has('DatabaseAccessDenied')) return 'PERMISSION';
  if (kinds.has('TableDoesNotExist')) return 'SCHEMA_OR_TABLE_MISSING';
  if (kinds.has('DatabaseDoesNotExist')) return 'DATABASE_MISSING';
  if (kinds.has('DatabaseNotReachable') || kinds.has('SocketTimeout') || kinds.has('ConnectionClosed')) return 'NETWORK';
  if (kinds.has('TlsConnectionError')) return 'TLS_CERTIFICATE';
  if ([...codes].some(code => /CERT|SELF_SIGNED|UNABLE_TO_VERIFY|ERR_TLS/.test(code))
    || /certificate|self.signed|unable to verify|hostname.*does not match/i.test(messages)) return 'TLS_CERTIFICATE';
  if (codes.has('28P01') || codes.has('P1000')) return 'AUTHENTICATION';
  if (codes.has('ENOTFOUND') || codes.has('EAI_AGAIN')) return 'DNS';
  if (codes.has('42501') || codes.has('P1010')) return 'PERMISSION';
  if (codes.has('42P01') || codes.has('3F000') || codes.has('P2021')) return 'SCHEMA_OR_TABLE_MISSING';
  if (codes.has('3D000')) return 'DATABASE_MISSING';
  if ([...codes].some(code => ['ETIMEDOUT', 'ECONNREFUSED', 'ENETUNREACH', 'EHOSTUNREACH', 'P1001', 'P1002'].includes(code))) return 'NETWORK';
  // Only standardized codes may appear in the fallback, never arbitrary text.
  const standardized = [...codes].filter(code => /^(?:P\d{4}|[0-9]{2}[0-9A-Z]{3})$/.test(code)).sort();
  return standardized.length ? `DRIVER_CODES_${standardized.join('_')}` : 'UNKNOWN';
}
