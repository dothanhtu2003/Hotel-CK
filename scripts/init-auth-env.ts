import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'dotenv';

const file = '.env';
if (!existsSync(file)) throw new Error('Configure the existing local database in .env first');
let contents = readFileSync(file, 'utf8');
const values = parse(contents);
if (values.JWT_SECRET) {
  console.log('JWT_SECRET already configured; existing value preserved.');
} else {
  const assignment = `JWT_SECRET="${randomBytes(48).toString('base64url')}"`;
  contents = /^\s*JWT_SECRET\s*=/m.test(contents)
    ? contents.replace(/^[ \t]*JWT_SECRET[ \t]*=.*$/m, assignment)
    : `${contents.trimEnd()}\n\n# Local JWT signing secret; never commit this file.\n${assignment}\n`;
  writeFileSync(file, contents, { mode: 0o600 });
  console.log('Random JWT_SECRET configured locally. Database settings preserved; secret not printed.');
}
