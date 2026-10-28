import { BadRequestException } from '@nestjs/common';
import { registerDecorator, type ValidationOptions } from 'class-validator';

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function IsStayDate(options?: ValidationOptions) {
  return (target: object, propertyName: string) => registerDecorator({
    name: 'isStayDate', target: target.constructor, propertyName, options,
    validator: { validate: isCalendarDate, defaultMessage: () => `${propertyName} must be a valid date in YYYY-MM-DD format` },
  });
}

export function parseStay(checkIn: string, checkOut: string) {
  if (!isCalendarDate(checkIn) || !isCalendarDate(checkOut)) throw new BadRequestException('Use valid YYYY-MM-DD stay dates');
  const start = new Date(`${checkIn}T00:00:00.000Z`);
  const end = new Date(`${checkOut}T00:00:00.000Z`);
  const nights = (end.getTime() - start.getTime()) / 86400000;
  if (nights <= 0) throw new BadRequestException('checkOut must be after checkIn');
  return { start, end, nights };
}
