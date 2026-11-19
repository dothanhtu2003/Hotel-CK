import { language, t, type TranslationKey } from './index';
import { formatDate } from './format';
import { enumLabel } from './status';

export type RevenueReceipt = {
  id: string; bookingId: string; reference: string; invoiceId?: string; room: string;
  guestId: string; guest: string; date: string; amount: string; method: 'CASH' | 'BANK_TRANSFER'; source: string; sourceCode?: string;
  roomAmount: string; serviceAmount: string; collector: string | null; refund: boolean;
};

export const revenueSourceKeys = {
  ROOM: 'reception:cashier.roomCharges', PAYOS_ROOM: 'common:sources.payosRoom',
  INVOICE: 'reception:cashier.invoice', PAYOS_INVOICE: 'common:sources.payosInvoice',
  SERVICE: 'reception:cashier.services', PAYOS_SERVICE: 'common:sources.payosService',
} satisfies Record<string, TranslationKey>;

export function revenueSource(row: { sourceCode?: string; source: string }): string {
  const key = row.sourceCode && Object.hasOwn(revenueSourceKeys, row.sourceCode) ? revenueSourceKeys[row.sourceCode as keyof typeof revenueSourceKeys] : undefined;
  if (key) return t(key);
  // Older API deployments retain compatibility; never parse their prose for meaning.
  return language() === 'vi' ? row.source : t('common:sources.other');
}

/** Human-readable columns follow UI language; canonical financial columns stay unchanged. */
export function buildRevenueCsv(rows: readonly RevenueReceipt[]): string {
  const cell = (value: string) => '"' + value.replace(/^[\s\uFEFF]*[=+\-@]/, match => "'" + match).replaceAll('"', '""') + '"';
  const headers: TranslationKey[] = ['reception:revenuePage.reservationCode', 'reception:revenuePage.invoiceId', 'reception:reservationPanels.room', 'reception:revenuePage.guest', 'reception:revenuePage.date', 'reception:paymentForm.method', 'reception:revenuePage.paymentSource', 'reception:revenuePage.collectedBy', 'reception:reservationPanels.status', 'reception:revenuePage.roomChargesVnd', 'reception:revenuePage.serviceChargesVnd', 'reception:revenuePage.amountVnd'];
  const lines = [headers.map(key => cell(t(key))).join(',')];
  for (const row of rows) {
    lines.push([
      row.reference, row.invoiceId ?? '', row.room, row.guest,
      formatDate(row.date, { dateStyle: 'short', timeStyle: 'short' }), enumLabel('PaymentMethod', row.method),
      revenueSource(row), row.collector ?? '', row.refund ? t('reception:revenuePage.refunded') : t('reception:tapeChart.confirmed'),
    ].map(cell).concat(row.roomAmount, row.serviceAmount, row.amount).join(','));
  }
  return lines.join('\r\n');
}
