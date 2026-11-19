import { formatDate as localizedDate } from "../i18n/format";
import { revenueSource, buildRevenueCsv } from "../i18n/revenue";
import { displayLocale, localized, t as tr, useLocale } from "../i18n";

import { Trans } from "react-i18next";
import { DeskLink } from '../features/reception/navigation';
import { Fragment, useMemo, useState } from 'react';
import {
  ChevronsUpDown,
  Download,
  Search,
  X,
} from 'lucide-react';
import { Link } from 'react-router';
import { ErrorState, Pagination } from '../components/ui';
import { useDeskBase, useDeskGet } from '../features/reception/queries';
import { hotelToday, shiftDate } from '../features/reception/room-state';
import './revenue-page.css';

const methods = localized(() => ({ CASH: tr("reception:cashier.cash"), BANK_TRANSFER: tr("reception:cashier.bankTransfer") } as const));
const presets = localized(() => ([[1, tr("reception:tapeChart.today")], [7, tr("reception:revenuePage.7Days")], [14, tr("reception:revenuePage.14Days")], [0, tr("reception:revenuePage.chooseDates")]] as const));
type Method = keyof typeof methods;
type Receipt = {
  id: string; bookingId: string; reference: string; invoiceId?: string; room: string;
  guestId: string; guest: string; date: string; amount: string; method: Method; source: string; sourceCode?: string;
  roomAmount: string; serviceAmount: string; collector: string | null; refund: boolean;
};
type Report = { pending: number; previousTotal: string; transactions: Receipt[] };
const money = localized(() => new Intl.NumberFormat(displayLocale(), { style: 'currency', currency: 'VND', maximumFractionDigits: 2 }));
const time = localized(() => new Intl.DateTimeFormat(displayLocale(), { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }));
const compact = localized(() => new Intl.NumberFormat(displayLocale(), { notation: 'compact', maximumFractionDigits: 1 }));
const format = (cents: number) => money.format(cents / 100);
const cents = (value: string) => Math.round(Number(value) * 100);
const share = (value: number, total: number) => total > 0 ? Math.round(value / total * 100) : 0;

function exportCsv(rows: Receipt[], from: string, to: string) {
  const url = URL.createObjectURL(new Blob(['\uFEFF', buildRevenueCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `doanh-thu-${from}-${to}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function RevenuePage() {
  const locale = useLocale();
  const today = hotelToday();
  const base = useDeskBase();
  const [period, setPeriod] = useState<number>(1);
  const [custom, setCustom] = useState({ from: shiftDate(today, -6), to: today });
  const [method, setMethod] = useState<Method | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandAll, setExpandAll] = useState(false);
  const [page, setPage] = useState(1);

  const { from, to } = period ? { from: shiftDate(today, 1 - period), to: today } : custom;
  const days = (Date.parse(to) - Date.parse(from)) / 86400000 + 1;
  const valid = days >= 1 && days <= 366 && to <= today;
  const query = useDeskGet<Report>(`/revenue?from=${from}&to=${to}`, valid);
  const rows = useMemo(() => query.data?.transactions ?? [], [query.data]);

  // Method filtering
  const filtered = useMemo(() => {
    void locale; // Recompute presentation when the language changes.

    return method === 'ALL' ? rows : rows.filter(row => row.method === method);
  }, [rows, method, locale]);

  // Search filtering
  const searched = useMemo(() => {
    void locale; // Recompute presentation when the language changes.

    if (!searchQuery.trim()) return filtered;
    const q = searchQuery.trim().toLowerCase();
    return filtered.filter(row =>
      row.guest.toLowerCase().includes(q) ||
      row.room.toLowerCase().includes(q) ||
      row.reference.toLowerCase().includes(q) ||
      (row.collector && row.collector.toLowerCase().includes(q)) ||
      revenueSource(row).toLowerCase().includes(q)
    );
  }, [filtered, searchQuery, locale]);

  // Grouped by guest
  const byGuest = useMemo(() => {
    void locale; // Recompute presentation when the language changes.

    const map = new Map<string, Receipt[]>();
    for (const row of searched) {
      const key = row.guestId ?? row.bookingId;
      const group = map.get(key);
      if (group) group.push(row);
      else map.set(key, [row]);
    }
    return map;
  }, [searched, locale]);

  const pageCount = Math.max(1, Math.ceil(byGuest.size / 15));
  const currentPage = Math.min(page, pageCount);
  const yesterday = shiftDate(today, -1);
  const pageGroups = useMemo(() => {
    void locale; // Recompute presentation when the language changes.

    return [...byGuest].slice((currentPage - 1) * 15, currentPage * 15);
  }, [byGuest, currentPage, locale]);

  const daily = Array.from({ length: valid ? days : 0 }, (_, i) => ({ date: shiftDate(from, i), CASH: 0, BANK_TRANSFER: 0 }));
  const collected = { CASH: 0, BANK_TRANSFER: 0 };
  for (const row of rows) {
    const date = hotelToday(new Date(row.date));
    const index = (Date.parse(date) - Date.parse(from)) / 86400000;
    if (daily[index]) daily[index][row.method] += cents(row.amount);
    if (!row.refund) collected[row.method] += cents(row.amount);
  }
  const hasRefund = rows.some(row => row.refund);
  const roomTotal = rows.reduce((sum, row) => sum + cents(row.roomAmount), 0);
  const serviceTotal = rows.reduce((sum, row) => sum + cents(row.serviceAmount), 0);
  const cash = daily.reduce((sum, d) => sum + d.CASH, 0);
  const bank = daily.reduce((sum, d) => sum + d.BANK_TRANSFER, 0);
  const total = cash + bank;
  const gross = collected.CASH + collected.BANK_TRANSFER;
  const bankShare = share(collected.BANK_TRANSFER, gross);
  const cashShare = share(collected.CASH, gross);
  const previous = cents(query.data?.previousTotal ?? '0');
  const delta = previous > 0 ? (total - previous) / previous * 100 : null;

  return (
    <div className="revenue-page">
      <header className="revenue-header">
        <h1>{tr("reception:revenuePage.revenue")}</h1>
        <div className="revenue-controls">
          <div className="revenue-segment" role="group" aria-label={tr("reception:revenuePage.reportingPeriod")}>
            {presets.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={value === period}
                onClick={() => { setPeriod(value); setPage(1); }}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            className="revenue-export"
            type="button"
            disabled={!filtered.length || query.isError || !valid}
            onClick={() => exportCsv(filtered, from, to)}
          >
            <Download size={16} /> {tr("reception:revenuePage.exportCsvExcel")}</button>
        </div>
        {period === 0 && (
          <div className="revenue-controls revenue-dates">
            <label>
              {tr("reception:revenuePage.fromDate")}{' '}
              <input
                type="date"
                value={from}
                max={today}
                onChange={event => { setCustom({ ...custom, from: event.target.value }); setPage(1); }}
              />
            </label>
            <label>
              {tr("reception:revenuePage.toDate")}{' '}
              <input
                type="date"
                value={to}
                max={today}
                onChange={event => { setCustom({ ...custom, to: event.target.value }); setPage(1); }}
              />
            </label>
          </div>
        )}
      </header>

      {!valid ? (
        <p role="alert">{tr("reception:revenuePage.chooseAPeriodOf1To366DaysEndingNoLaterThan")}</p>
      ) : query.isError ? (
        <ErrorState message={tr("reception:revenuePage.unableToLoadTheRevenueReport")} retry={() => void query.refetch()} />
      ) : !query.data ? (
        <p role="status">{tr("reception:revenuePage.loadingRevenueReport")}</p>
      ) : (
        <>
          {query.data.pending > 0 && (
            <div className="revenue-note">
              <strong>{tr("reception:revenuePage.reviewRequired")}</strong> · {query.data.pending} {tr("reception:revenuePage.payosPaymentsAwaitingReview")}{' '}
              <Link to={`${base}/billing`}>{tr("reception:revenuePage.openPaymentReviewQueue")}</Link>
            </div>
          )}

          <section className="revenue-kpis" aria-label={tr("reception:revenuePage.revenueSummary")}>
            <div className="revenue-card revenue-primary">
              <span>{tr("reception:revenuePage.netCollectedPayments")}</span>
              <strong>{format(total)}</strong>
              <small>
                {delta === null
                  ? tr("reception:revenuePage.previousPeriodValue", { value0: (format(previous)) })
                  : tr("reception:revenuePage.valueValueComparedWithPreviousPeriod", { value0: (delta > 0 ? '+' : ''), value1: (delta.toLocaleString(displayLocale(), { maximumFractionDigits: 1 })) })}
              </small>
            </div>
            <div className="revenue-card">
              <span>{tr("reception:cashier.cash")}</span>
              <strong>{format(cash)}</strong>
              <small>{cashShare}% {hasRefund ? tr("reception:revenuePage.totalCollectedBeforeRefunds") : tr("reception:revenuePage.totalCollected")}</small>
            </div>
            <div className="revenue-card">
              <span>{tr("reception:cashier.bankTransfer")}</span>
              <strong>{format(bank)}</strong>
              <small>{bankShare}% {hasRefund ? tr("reception:revenuePage.totalCollectedBeforeRefunds") : tr("reception:revenuePage.totalCollected")}</small>
            </div>
            <div className="revenue-card">
              <span>{tr("reception:revenuePage.collectedTransactions")}</span>
              <strong>{rows.filter(row => !row.refund).length.toLocaleString(displayLocale())}</strong>
              <small>{tr("reception:revenuePage.confirmedReceiptsOnly")}</small>
            </div>
          </section>

          <section className="revenue-kpis revenue-sources" aria-label={tr("reception:revenuePage.netCollectedPaymentsBySource")}>
            <div className="revenue-card">
              <span>{tr("reception:cashier.roomCharges")}</span>
              <strong>{format(roomTotal)}</strong>
              <small>{tr("reception:revenuePage.netCollectedRoomPayments")}</small>
            </div>
            <div className="revenue-card">
              <span>{tr("reception:revenuePage.serviceCharges")}</span>
              <strong>{format(serviceTotal)}</strong>
              <small>{hasRefund ? tr("reception:revenuePage.servicePaymentsCollectedLessRecordedRefunds") : tr("reception:revenuePage.servicePaymentsCollected")}</small>
            </div>
          </section>

          <section className="revenue-charts" aria-label={tr("reception:revenuePage.revenueChart")}>
            <div className="revenue-card">
              <h2>{tr("reception:revenuePage.dailyCollectedPayments")}</h2>
              <p>{hasRefund ? tr("reception:revenuePage.netCollectedPaymentsByMethodAfterRecordedRefunds") : tr("reception:revenuePage.netCollectedPaymentsByPaymentMethod")}</p>
              <div className="revenue-legend"><span>{tr("reception:cashier.cash")}</span><span>{tr("reception:cashier.bankTransfer")}</span></div>
              <RevenueBars daily={daily} />
            </div>
            <div className="revenue-card">
              <h2>{tr("reception:revenuePage.paymentMix")}</h2>
              <p>{hasRefund ? tr("reception:revenuePage.collectedPaymentsBeforeRefunds") : tr("reception:revenuePage.paymentsCollectedInTheSelectedPeriod")}</p>
              <div
                className="revenue-donut"
                role="img"
                aria-label={tr("reception:revenuePage.cashValueBankTransferValue", { value0: (cashShare), value1: (bankShare) })}
                style={{ background: gross ? `conic-gradient(var(--rev-bank) ${bankShare}%, var(--rev-cash) 0)` : 'var(--rev-line)' }}
              >
                <div><Trans ns="reception" i18nKey="revenuePage.valueBankTransfer" values={{ value0: (bankShare) }} components={{ part0: <strong />, part1: <small /> }} /></div>
              </div>
              <div className="revenue-breakdown"><span>{tr("reception:cashier.cash")}</span><b>{format(collected.CASH)}</b></div>
              <div className="revenue-breakdown"><span>{tr("reception:cashier.bankTransfer")}</span><b>{format(collected.BANK_TRANSFER)}</b></div>
            </div>
          </section>

          {/* Section: Giao dịch trong kỳ (Gom theo từng khách hàng) */}
          <section className="revenue-card">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4 pb-3 border-b border-zinc-100">
              <div>
                <h2 className="text-base font-bold text-zinc-900 m-0">{tr("reception:revenuePage.transactionsInThisPeriod")}</h2>
                <p className="text-xs text-zinc-500 m-0 mt-0.5">{tr("reception:revenuePage.valueGuestsValueTransactionsValueValue", { value0: (byGuest.size.toLocaleString(displayLocale())), value1: (filtered.length.toLocaleString(displayLocale())), value2: (method !== 'ALL' ? ` · ${methods[method]}` : ''), value3: (searchQuery.trim() && tr("common:supplement.searchResults", { value0: searched.length })) })}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search Input */}
                <div className="relative w-full sm:w-52">
                  <Search className="size-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder={tr("reception:revenuePage.searchRoomGuestCode")}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    className="h-8 w-full pl-8 pr-7 text-xs border border-zinc-200 rounded-lg bg-zinc-50/70 focus:bg-white focus:border-brand-600 focus:outline-none transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setPage(1);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer p-0.5"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>

                {/* Payment Method Filter */}
                <div className="revenue-segment" role="group" aria-label={tr("reception:unifiedBookingModal.paymentMethod")}>
                  {(['ALL', 'CASH', 'BANK_TRANSFER'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={value === method}
                      onClick={() => {
                        setMethod(value);
                        setPage(1);
                      }}
                    >
                      {value === 'ALL' ? tr("reception:createServiceOrder.all") : methods[value]}
                    </button>
                  ))}
                </div>

                {/* Toggle All Groups */}
                <button
                  type="button"
                  onClick={() => setExpandAll(!expandAll)}
                  className="h-8 px-2.5 rounded-lg text-xs font-medium border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 transition-colors inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                >
                  <ChevronsUpDown className="size-3.5 text-zinc-400" />
                  <span>{expandAll ? tr("reception:revenuePage.collapse") : tr("reception:revenuePage.expandAll")}</span>
                </button>
              </div>
            </div>

            {/* Grouped Table View */}
            <div className="revenue-table">
              <table aria-label={tr("reception:revenuePage.revenueTransactions")}>
                <thead>
                  <tr>
                    {[tr("reception:revenuePage.time"), tr("reception:revenuePage.transaction"), tr("reception:revenuePage.reservationCode"), tr("reception:reservationPanels.room"), tr("reception:revenuePage.guest"), tr("reception:paymentForm.method"), tr("reception:revenuePage.collectedBy"), tr("reception:reservationPanels.status"), tr("reception:cashier.roomCharges"), tr("reception:revenuePage.serviceCharges"), tr("reception:reservationPanels.amount")].map((label) => (
                      <th scope="col" key={label}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageGroups.map(([guestId, group]) => {
                    const latest = group[0];
                    const open = expanded === guestId || expandAll;
                    const room = group.reduce((sum, row) => sum + cents(row.roomAmount), 0);
                    const service = group.reduce((sum, row) => sum + cents(row.serviceAmount), 0);
                    const methodsInGroup = Array.from(new Set(group.map((r) => r.method)));

                    return (
                      <Fragment key={guestId}>
                        <tr className="revenue-guest">
                          <td colSpan={8}>
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <button
                                type="button"
                                aria-expanded={open}
                                onClick={() => setExpanded(open && !expandAll ? null : guestId)}
                                className="revenue-guest-toggle flex items-center gap-1.5 cursor-pointer"
                              >
                                <span aria-hidden="true" className="revenue-chevron">{open ? '▾' : '▸'}</span>
                                <strong>{latest.guest}</strong>
                                <span>{tr("reception:revenuePage.valueTransactions", { value0: (group.length) })}</span>
                              </button>

                              {/* Customer meta info to balance the columns */}
                              <div className="flex items-center gap-2">
                                <span className="revenue-room-badge">{tr("reception:cashier.roomValue", { value0: (latest.room) })}</span>
                                <span className="font-mono text-xs text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">{tr("reception:revenuePage.codeValue", { value0: (latest.reference) })}</span>
                                <div className="flex items-center gap-1">
                                  {methodsInGroup.map((m) => (
                                    <span key={m} className={`revenue-tag ${m}`}>
                                      {methods[m]}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>{format(room)}</td>
                          <td>{format(service)}</td>
                          <td><b>{format(room + service)}</b></td>
                        </tr>

                        {open && group.map((row, index) => {
                          const date = hotelToday(new Date(row.date));
                          const previous = group[index - 1];
                          const startsDay = !previous || hotelToday(new Date(previous.date)) !== date;
                          const label = date === today ? tr("reception:tapeChart.today") : date === yesterday ? tr("reception:revenuePage.yesterday") : '';
                          const dateLabel = localizedDate(date);
                          const description = row.refund
                            ? tr("reception:revenuePage.serviceRefund")
                            : cents(row.roomAmount) && cents(row.serviceAmount)
                            ? tr("reception:revenuePage.collectRoomAndServicePayment")
                            : cents(row.roomAmount)
                            ? tr("reception:revenuePage.collectRoomPayment")
                            : tr("reception:revenuePage.collectServicePayment");

                          return (
                            <Fragment key={row.id}>
                              {startsDay && (
                                <tr className="revenue-day">
                                  <td colSpan={11}>
                                    {label ? (
                                      <>
                                        <strong>{label}</strong> <span>· {dateLabel}</span>
                                      </>
                                    ) : (
                                      <strong>{dateLabel}</strong>
                                    )}
                                  </td>
                                </tr>
                              )}
                              <tr className="revenue-tx-row">
                                <td>
                                  <time dateTime={row.date}>{time.format(new Date(row.date))}</time>
                                </td>
                                <td>
                                  <strong>{description}</strong>
                                  <small>{revenueSource(row)}</small>
                                </td>
                                <td>
                                  <DeskLink to={`${base}/bookings/${row.bookingId}`} className="font-mono">
                                    {row.reference}
                                  </DeskLink>
                                </td>
                                <td>
                                  <span className="revenue-room-badge">{tr("reception:createServiceOrder.rm")}{row.room}</span>
                                </td>
                                <td>{row.guest}</td>
                                <td>
                                  <span className={`revenue-tag ${row.method}`}>
                                    {methods[row.method]}
                                  </span>
                                </td>
                                <td>{row.collector ?? '—'}</td>
                                <td>
                                  {row.refund ? (
                                    <span className="revenue-refund-tag">{tr("reception:revenuePage.refunded")}</span>
                                  ) : (
                                    tr("reception:tapeChart.confirmed")
                                  )}
                                </td>
                                <td>{cents(row.roomAmount) > 0 ? format(cents(row.roomAmount)) : '0 ₫'}</td>
                                <td>{cents(row.serviceAmount) > 0 ? format(cents(row.serviceAmount)) : '0 ₫'}</td>
                                <td>
                                  <b>{format(cents(row.amount))}</b>
                                </td>
                              </tr>
                            </Fragment>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                  {!filtered.length && (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-zinc-400">{tr("reception:revenuePage.noTransactionsInTheSelectedPeriod")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pageCount > 1 && (
              <div className="mt-4 pt-3 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs text-zinc-500"><Trans ns="reception" i18nKey="revenuePage.showingValueValueGuestsValueTransactions" values={{ value0: (pageGroups.length), value1: (byGuest.size), value2: (filtered.length) }} components={{ part0: <strong className="text-zinc-800 font-semibold" /> }} /></span>
                <Pagination page={currentPage} pageSize={15} total={byGuest.size} onChange={setPage} />
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function RevenueBars({ daily }: { daily: { date: string; CASH: number; BANK_TRANSFER: number }[] }) {
  useLocale();
  const max = Math.max(1, ...daily.map(d => Math.max(0, d.CASH) + Math.max(0, d.BANK_TRANSFER)));
  const min = Math.min(0, ...daily.map(d => Math.min(0, d.CASH) + Math.min(0, d.BANK_TRANSFER)));
  const y = (value: number) => 18 + (max - value) / (max - min) * 192;
  const slot = 570 / daily.length;
  const width = Math.min(36, slot * .65);
  return <svg viewBox="0 0 640 242" role="img" aria-label={tr("reception:revenuePage.dailyNetCollectedPaymentsBarChart")}>
    {[min, min + (max - min) / 4, (min + max) / 2, max - (max - min) / 4, max].map(value => <g key={value}>
      <line x1="64" x2="638" y1={y(value)} y2={y(value)} />
      <text x="0" y={y(value) + 4}>{compact.format(value / 100)}</text>
    </g>)}
    {daily.map((d, i) => {
      const x = 66 + slot * (i + .5);
      const bankBase = d.BANK_TRANSFER >= 0 ? Math.max(0, d.CASH) : Math.min(0, d.CASH);
      return <g key={d.date}>
        <title>{tr("reception:revenuePage.valueCashValueBankTransferValue", { value0: (d.date), value1: (format(d.CASH)), value2: (format(d.BANK_TRANSFER)) })}</title>
        <rect x={x - width / 2} y={Math.min(y(0), y(d.CASH))} width={width} height={Math.abs(y(0) - y(d.CASH))} fill="var(--rev-cash)" />
        <rect x={x - width / 2} y={Math.min(y(bankBase), y(bankBase + d.BANK_TRANSFER))} width={width}
          height={Math.abs(y(bankBase) - y(bankBase + d.BANK_TRANSFER))} fill="var(--rev-bank)" />
        {i % Math.ceil(daily.length / 7) === 0 && <text x={x} y="234" textAnchor="middle">{localizedDate(d.date, { month: '2-digit', day: '2-digit' })}</text>}
      </g>;
    })}
  </svg>;
}
