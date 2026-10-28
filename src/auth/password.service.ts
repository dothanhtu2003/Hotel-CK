import { Injectable, type OnModuleInit } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash!: string;

  async onModuleInit() {
    this.dummyHash = await this.hash(randomBytes(32).toString('base64url'));
  }

  hash(password: string) {
    return argon2.hash(password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
  }

  async verify(hash: string | undefined, password: string) {
    if (!hash) { await argon2.verify(this.dummyHash, password); return false; }
    try {
      if (hash.startsWith('$argon2id$')) return await argon2.verify(hash, password);
      // Compatibility with existing demo hashes; no silent mutation/rehash of seed users.
      if (/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/.test(hash)) {
        const [,salt,key] = hash.split('$');
        const actual = await new Promise<Buffer>((resolve,reject) => scrypt(password,salt,64,{N:16384,r:8,p:1},(error,value) => error ? reject(error) : resolve(value)));
        return timingSafeEqual(Buffer.from(key,'hex'), actual);
      }
    } catch { return false; }
    return false;
  }
}
