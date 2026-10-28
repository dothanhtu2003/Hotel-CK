import { plainToInstance } from 'class-transformer';
import { IsIn, IsInt, IsString, Matches, Max, MaxLength, Min, MinLength, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV = 'development';

  @IsIn(['127.0.0.1', 'localhost', '::1', '0.0.0.0'])
  HOST = '127.0.0.1';

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3000;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  CORS_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173';

  @IsString()
  @MinLength(32)
  @MaxLength(4096)
  @Matches(/^\S+$/)
  JWT_SECRET!: string;

  @IsInt()
  @Min(60)
  @Max(3600)
  JWT_ACCESS_TTL_SECONDS = 900;

  @IsInt()
  @Min(1)
  @Max(1000)
  AUTH_RATE_LIMIT = 5;

  @IsInt()
  @Min(1000)
  @Max(3600000)
  AUTH_RATE_TTL_MS = 60000;
}

export function validateEnvironment(input: Record<string, unknown>) {
  const config = plainToInstance(EnvironmentVariables, {
    ...input,
    PORT: input.PORT === undefined ? 3000 : Number(input.PORT),
    JWT_ACCESS_TTL_SECONDS: input.JWT_ACCESS_TTL_SECONDS === undefined ? 900 : Number(input.JWT_ACCESS_TTL_SECONDS),
    AUTH_RATE_LIMIT: input.AUTH_RATE_LIMIT === undefined ? 5 : Number(input.AUTH_RATE_LIMIT),
    AUTH_RATE_TTL_MS: input.AUTH_RATE_TTL_MS === undefined ? 60000 : Number(input.AUTH_RATE_TTL_MS),
  }, { exposeDefaultValues: true });
  const errors = validateSync(config, { validationError: { target: false, value: false } });
  if (errors.length) {
    throw new Error(`Invalid environment fields: ${errors.map(error => error.property).sort().join(', ')}`);
  }
  if (config.HOST === '0.0.0.0' && config.NODE_ENV !== 'production') throw new Error('HOST=0.0.0.0 requires NODE_ENV=production');
  try {
    const url = new URL(config.DATABASE_URL);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.pathname.slice(1) || url.searchParams.get('schema') !== 'hotel') {
      throw new Error();
    }
  } catch {
    throw new Error('DATABASE_URL must be a PostgreSQL URL with schema=hotel');
  }
  if (config.NODE_ENV === 'production' && new URL(config.DATABASE_URL).searchParams.get('sslmode') !== 'verify-full') {
    throw new Error('Production DATABASE_URL requires sslmode=verify-full and a trusted server certificate');
  }
  const origins = config.CORS_ORIGINS.split(',').map(origin => origin.trim());
  if (!origins.length || origins.some(origin => {
    try {
      const url = new URL(origin);
      return !['http:', 'https:'].includes(url.protocol) || url.origin !== origin;
    } catch { return true; }
  })) throw new Error('CORS_ORIGINS must contain explicit HTTP(S) origins separated by commas');
  return { ...input, ...config, CORS_ORIGINS: origins.join(',') };
}
