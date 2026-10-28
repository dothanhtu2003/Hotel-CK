import { Injectable, HttpException, HttpStatus, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, { attempts: number; expiresAt: number }>();
  private nextCleanup = 0;

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const now = Date.now();
    const ttl = this.config.getOrThrow<number>('AUTH_RATE_TTL_MS');
    const limit = this.config.getOrThrow<number>('AUTH_RATE_LIMIT');
    if (now >= this.nextCleanup) {
      for (const [key, value] of this.buckets) if (value.expiresAt <= now) this.buckets.delete(key);
      this.nextCleanup = now + ttl;
    }
    // Express trust proxy stays disabled: forwarded headers cannot choose the key.
    const key = `${request.ip ?? request.socket.remoteAddress}:${context.getClass().name}:${context.getHandler().name}`;
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.expiresAt <= now) {
      // Keep memory bounded without evicting active bans to make space for new IPs.
      if (!bucket && this.buckets.size >= 10000) {
        response.setHeader('Retry-After', Math.ceil(ttl / 1000));
        throw new HttpException('Too many authentication attempts', HttpStatus.TOO_MANY_REQUESTS);
      }
      bucket = { attempts: 0, expiresAt: now + ttl };
      this.buckets.set(key, bucket);
    }
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-RateLimit-Limit', limit);
    if (bucket.attempts >= limit) {
      response.setHeader('Retry-After', Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000)));
      throw new HttpException('Too many authentication attempts', HttpStatus.TOO_MANY_REQUESTS);
    }
    bucket.attempts++;
    response.setHeader('X-RateLimit-Remaining', limit - bucket.attempts);
    return true;
  }
}
