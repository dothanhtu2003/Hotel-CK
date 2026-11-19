import { config } from 'dotenv';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const owned = /^hotel_e2e_[a-f0-9]{32}$/;
let administrationUrl;
function baseUrl() {
  if (administrationUrl) return new URL(administrationUrl);
  config({ path: root + '.env', quiet: true });
  const url = new URL(process.env.TEST_DATABASE_URL ?? '');
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.pathname !== '/hotel_test' || url.searchParams.get('schema') !== 'hotel') throw new Error('E2E database administration requires local hotel_test with schema=hotel');
  administrationUrl=url.toString();
  return url;
}
export async function createDatabase() {
  const url = baseUrl(), name = 'hotel_e2e_' + randomUUID().replaceAll('-', '');
  const client = new pg.Client({ connectionString: url.toString() }); await client.connect();
  try {
    const result = await client.query('SELECT current_database() AS name');
    if (result.rows[0].name !== 'hotel_test' || !owned.test(name)) throw new Error('Refusing E2E database creation');
    await client.query(`CREATE DATABASE "${name}"`);
    await client.query(`COMMENT ON DATABASE "${name}" IS 'hotel-ck-playwright:${name}'`);
  } finally { await client.end(); }
  url.pathname = '/' + name;
  try { execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { cwd: root, env: { ...process.env, DIRECT_URL: url.toString(), DATABASE_URL: url.toString() }, stdio: 'pipe' }); }
  catch { await dropDatabase(name); throw new Error('Could not apply existing migrations to disposable E2E database'); }
  return { name, url: url.toString() };
}
export async function dropDatabase(name) {
  if (!owned.test(name)) throw new Error('Refusing to drop a database without an exact E2E run name');
  const client = new pg.Client({ connectionString: baseUrl().toString() }); await client.connect();
  try {
    const actual = await client.query('SELECT current_database() AS name');
    if (actual.rows[0].name !== 'hotel_test') throw new Error('Unexpected administration database');
    const found = await client.query('SELECT shobj_description(oid, $2) AS marker FROM pg_database WHERE datname=$1', [name, 'pg_database']);
    if (!found.rowCount) return;
    if (found.rows[0].marker !== 'hotel-ck-playwright:' + name) throw new Error('Refusing to drop a database without its ownership marker');
    await client.query(`DROP DATABASE "${name}" WITH (FORCE)`);
  } finally { await client.end(); }
}
export default async function teardown() {
  const fixture = JSON.parse(readFileSync(root + '.local/frontend-e2e-fixtures.json', 'utf8'));
  if (!fixture.databaseName) throw new Error('Missing disposable E2E database ownership manifest');
  await dropDatabase(fixture.databaseName);
}
