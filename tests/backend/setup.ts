import 'reflect-metadata';
import { randomBytes } from 'node:crypto';

// Test signing keys are ephemeral, never a production default or printed credential.
process.env.JWT_SECRET = randomBytes(48).toString('base64url');
