import { displayLocale } from './index';

export const hotelTimeZone = 'Asia/Ho_Chi_Minh';

/** Format exact decimal VND strings without a lossy conversion to Number. */
export function formatMoney(value: string): string {
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(value)) throw new TypeError('Invalid decimal');
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = value.replace(/^-/, '').split('.');
  const parts = new Intl.NumberFormat(displayLocale(), {
    style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).formatToParts(negative ? -BigInt(whole) : BigInt(whole));
  const hasFraction = Number(fraction) !== 0;
  const decimal = new Intl.NumberFormat(displayLocale()).formatToParts(1.5).find(part => part.type === 'decimal')!.value;
  let lastInteger = -1;
  parts.forEach((part, index) => { if (part.type === 'integer') lastInteger = index; });
  if (hasFraction) parts.splice(lastInteger + 1, 0, { type: 'decimal', value: decimal }, { type: 'fraction', value: fraction.padEnd(2, '0') });
  if (negative && BigInt(whole) === 0n && hasFraction) parts.unshift({ type: 'minusSign', value: '-' });
  // Keep the existing ordinary separating space for Vietnamese receipt assertions.
  return parts.map(part => part.value).join('').replace(/\u00a0/g, ' ');
}

export function formatDate(value: string | Date, options: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' }): string {
  const date = typeof value === 'string' ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T00:00:00Z' : value) : value;
  return new Intl.DateTimeFormat(displayLocale(), { ...options, timeZone: hotelTimeZone })
    .formatToParts(date).map(part => part.type === 'literal' && part.value === '-' ? '/' : part.value).join('');
}
