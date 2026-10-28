import { describe, expect, it } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { createValidationPipe } from '../../src/configure-app.js';

// Only a test DTO; does not add a business endpoint to the application.
class SampleDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

describe('Validation foundation', () => {
  const pipe = createValidationPipe();
  const metadata = { type: 'body' as const, metatype: SampleDto };

  it('transforms and validates declared DTO fields', async () => {
    const value = await pipe.transform({ quantity: '2' }, metadata) as SampleDto;
    expect(value).toBeInstanceOf(SampleDto);
    expect(value.quantity).toBe(2);
  });

  it('rejects invalid values and extra properties', async () => {
    await expect(pipe.transform({ quantity: 0 }, metadata)).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform({ quantity: 1, unexpected: true }, metadata)).rejects.toBeInstanceOf(BadRequestException);
  });
});
