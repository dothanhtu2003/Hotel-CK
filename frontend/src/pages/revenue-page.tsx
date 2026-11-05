import { Fragment, useState } from 'react';
import { Download } from 'lucide-react';
import { Link } from 'react-router';
import { ErrorState, Pagination } from '../components/ui';
import { useDeskBase, useDeskGet } from '../features/reception/queries';
import { hotelToday, shiftDate } from '../features/reception/room-state';
import './revenue-page.css';

const methods = { CASH: 'Tiền mặt', BANK_TRANSFER: 'Chuyển khoản' } as const;
const presets = [[1, 'Hôm nay'], [7, '7 ngày'], [14, '14 ngày'], [0, 'Chọn ngày']] as const;
type Method = keyof typeof methods;
type Receipt = {
  id: string; bookingId: string; reference: string; invoiceId?: string; room: string;
  guest: string; date: string; amount: string; method: Method; source: string;
  roomAmount: string; serviceAmount: string; collector: string | null; refund: boolean;
};
type Report = { pending: number; previousTotal: string; transactions: Receipt[] };
const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 2 });
const stamp = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });
const time = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
const compact = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 });
const format = (cents: number) => money.format(cents / 100);
const cents = (value: string) => Math.round(Number(value) * 100);
const share = (value: number, total: number) => total > 0 ? Math.round(value / total * 100) : 0;

function exportCsv(rows: Receipt[], from: string, to: string) {
  const cell = (value: string) => '"' + value.replace(/^[\s\uFEFF]*[=+\-@]/, match => "'" + match).replaceAll('"', '""') + '"';
  const lines = [['Mã booking', 'Mã hóa đơn', 'Phòng', 'Khách', 'Ngày', 'Phương thức', 'Nguồn thu', 'Người thu', 'Trạng thái', 'Tiền phòng (VND)', 'Tiền dịch vụ (VND)', 'Số tiền (VND)'].map(cell).join(',')];
  for (const row of rows) {
    lines.push([
      row.reference, row.invoiceId ?? '', row.room, row.guest, stamp.format(new Date(row.date)),
      methods[row.method], row.source, row.collector ?? '', row.refund ? 'Đã hoàn tiền' : 'Đã xác nhận',
    ].map(cell).concat(row.roomAmount, row.serviceAmount, row.amount).join(','));
  }
  const url = URL.createObjectURL(new Blob(['\uFEFF', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `doanh-thu-${from}-${to}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function RevenuePage() {
  const today = hotelToday();
  const base = useDeskBase();
  const [period, setPeriod] = useState<number>(1);
  const [custom, setCustom] = useState({ from: shiftDate(today, -6), to: today });
  const [method, setMethod] = useState<Method | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const { from, to } = period ? { from: shiftDate(today, 1 - period), to: today } : custom;
  const days = (Date.parse(to) - Date.parse(from)) / 86400000 + 1;
  const valid = days >= 1 && days <= 366 && to <= today;
  const query = useDeskGet<Report>(`/revenue?from=${from}&to=${to}`, valid);
  const rows = query.data?.transactions ?? [];
  const filtered = method === 'ALL' ? rows : rows.filter(row => row.method === method);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 15));
  const currentPage = Math.min(page, pageCount);
  const yesterday = shiftDate(today, -1);
  const pageRows = filtered.slice((currentPage - 1) * 15, currentPage * 15);
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

  return <div className="revenue-page">
    <header className="revenue-header">
      <h1>Doanh thu</h1>
      <div className="revenue-controls">
        <div className="revenue-segment" role="group" aria-label="Kỳ báo cáo">
          {presets.map(([value, label]) => <button key={value} type="button" aria-pressed={value === period}
            onClick={() => { setPeriod(value); setPage(1); }}>{label}</button>)}
        </div>
        <button className="revenue-export" type="button" disabled={!filtered.length || query.isError || !valid}
          onClick={() => exportCsv(filtered, from, to)}><Download size={16} /> Xuất CSV (Excel)</button>
      </div>
      {period === 0 && <div className="revenue-controls revenue-dates">
        <label>Từ ngày <input type="date" value={from} max={today}
          onChange={event => { setCustom({ ...custom, from: event.target.value }); setPage(1); }} /></label>
        <label>Đến ngày <input type="date" value={to} max={today}
          onChange={event => { setCustom({ ...custom, to: event.target.value }); setPage(1); }} /></label>
      </div>}
    </header>
    {!valid ? <p role="alert">Chọn khoảng từ 1 đến 366 ngày, kết thúc chậm nhất hôm nay.</p> :
      query.isError ? <ErrorState message="Không tải được báo cáo doanh thu." retry={() => void query.refetch()} /> :
      !query.data ? <p role="status">Đang tải báo cáo doanh thu…</p> : <>
      {query.data.pending > 0 && <div className="revenue-note">
        <strong>Cần đối soát</strong> · {query.data.pending} khoản thanh toán payOS đang chờ xử lý.{' '}
        <Link to={`${base}/billing`}>Mở hàng chờ đối soát</Link>
      </div>}
      <section className="revenue-kpis" aria-label="Tổng hợp doanh thu">
        <div className="revenue-card revenue-primary"><span>Tổng thực thu</span><strong>{format(total)}</strong>
          <small>{delta === null ? `Kỳ trước ${format(previous)}` : `${delta > 0 ? '+' : ''}${delta.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}% so với kỳ trước`}</small></div>
        <div className="revenue-card"><span>Tiền mặt</span><strong>{format(cash)}</strong><small>{cashShare}% {hasRefund ? 'tổng tiền thu trước hoàn' : 'tổng tiền thu'}</small></div>
        <div className="revenue-card"><span>Chuyển khoản</span><strong>{format(bank)}</strong><small>{bankShare}% {hasRefund ? 'tổng tiền thu trước hoàn' : 'tổng tiền thu'}</small></div>
        <div className="revenue-card"><span>Số giao dịch đã thu</span><strong>{rows.filter(row => !row.refund).length.toLocaleString('vi-VN')}</strong><small>Chỉ tính khoản đã xác nhận</small></div>
      </section>
      <section className="revenue-kpis revenue-sources" aria-label="Thực thu theo nguồn">
        <div className="revenue-card"><span>Tiền phòng</span><strong>{format(roomTotal)}</strong><small>Thực thu tiền lưu trú</small></div>
        <div className="revenue-card"><span>Tiền dịch vụ</span><strong>{format(serviceTotal)}</strong><small>{hasRefund ? 'Tiền dịch vụ đã thu, trừ khoản hoàn đã ghi nhận' : 'Tiền dịch vụ đã thu'}</small></div>
      </section>
      <section className="revenue-charts" aria-label="Biểu đồ doanh thu">
        <div className="revenue-card"><h2>Doanh thu theo ngày</h2><p>{hasRefund ? 'Thực thu theo phương thức, đã trừ khoản hoàn ghi nhận' : 'Thực thu theo phương thức thanh toán'}</p>
          <div className="revenue-legend"><span>Tiền mặt</span><span>Chuyển khoản</span></div>
          <RevenueBars daily={daily} />
        </div>
        <div className="revenue-card"><h2>Cơ cấu thanh toán</h2><p>{hasRefund ? 'Tiền thu trước khi trừ khoản hoàn' : 'Tiền thu trong kỳ đã chọn'}</p>
          <div className="revenue-donut" role="img" aria-label={`Tiền mặt ${cashShare}%, chuyển khoản ${bankShare}%`}
            style={{ background: gross ? `conic-gradient(var(--rev-bank) ${bankShare}%, var(--rev-cash) 0)` : 'var(--rev-line)' }}>
            <div><strong>{bankShare}%</strong><small>chuyển khoản</small></div>
          </div>
          <div className="revenue-breakdown"><span>Tiền mặt</span><b>{format(collected.CASH)}</b></div>
          <div className="revenue-breakdown"><span>Chuyển khoản</span><b>{format(collected.BANK_TRANSFER)}</b></div>
        </div>
      </section>
      <section className="revenue-card">
        <div className="revenue-header"><div><h2>Giao dịch trong kỳ</h2><p>{filtered.length.toLocaleString('vi-VN')} giao dịch{method === 'ALL' ? '' : ` · ${methods[method]}`}</p></div>
          <div className="revenue-segment" role="group" aria-label="Phương thức thanh toán">
            {(['ALL', 'CASH', 'BANK_TRANSFER'] as const).map(value => <button key={value} type="button"
              aria-pressed={value === method} onClick={() => { setMethod(value); setPage(1); }}>
              {value === 'ALL' ? 'Tất cả' : methods[value]}</button>)}
          </div>
        </div>
        <div className="revenue-table"><table aria-label="Giao dịch doanh thu">
          <thead><tr>{['Giờ', 'Giao dịch', 'Mã booking', 'Phòng', 'Khách', 'Phương thức', 'Người thu', 'Trạng thái', 'Tiền phòng', 'Tiền dịch vụ', 'Số tiền'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{pageRows.map((row, index) => {
            const date = hotelToday(new Date(row.date));
            const previous = pageRows[index - 1];
            const startsDay = !previous || hotelToday(new Date(previous.date)) !== date;
            const label = date === today ? 'Hôm nay' : date === yesterday ? 'Hôm qua' : '';
            const dateLabel = date.split('-').reverse().join('/');
            const description = row.refund ? 'Hoàn tiền dịch vụ'
              : cents(row.roomAmount) && cents(row.serviceAmount) ? 'Thu tiền phòng và dịch vụ'
              : cents(row.roomAmount) ? 'Thu tiền phòng' : 'Thu tiền dịch vụ';
            return <Fragment key={row.id}>
              {startsDay && <tr className="revenue-day"><td colSpan={11}>
                {label ? <><strong>{label}</strong> <span>· {dateLabel}</span></> : <strong>{dateLabel}</strong>}
              </td></tr>}
              <tr>
                <td><time dateTime={row.date}>{time.format(new Date(row.date))}</time></td>
                <td><strong>{description}</strong><small>{row.source}</small></td>
                <td><Link to={`${base}/bookings/${row.bookingId}`}>{row.reference}</Link></td><td>{row.room}</td><td>{row.guest}</td>
                <td><span className={`revenue-tag ${row.method}`}>{methods[row.method]}</span></td>
                <td>{row.collector ?? '—'}</td><td>{row.refund ? 'Đã hoàn tiền' : 'Đã xác nhận'}</td>
                <td>{format(cents(row.roomAmount))}</td><td>{format(cents(row.serviceAmount))}</td>
                <td><b>{format(cents(row.amount))}</b></td>
              </tr>
            </Fragment>;
          })}
          {!filtered.length && <tr><td colSpan={11}>Không có giao dịch trong kỳ đã chọn.</td></tr>}</tbody>
        </table></div>
        {pageCount > 1 && <Pagination page={currentPage} pageSize={15} total={filtered.length} onChange={setPage} />}
      </section>
    </>}
  </div>;
}

function RevenueBars({ daily }: { daily: { date: string; CASH: number; BANK_TRANSFER: number }[] }) {
  const max = Math.max(1, ...daily.map(d => Math.max(0, d.CASH) + Math.max(0, d.BANK_TRANSFER)));
  const min = Math.min(0, ...daily.map(d => Math.min(0, d.CASH) + Math.min(0, d.BANK_TRANSFER)));
  const y = (value: number) => 18 + (max - value) / (max - min) * 192;
  const slot = 570 / daily.length;
  const width = Math.min(36, slot * .65);
  return <svg viewBox="0 0 640 242" role="img" aria-label="Biểu đồ cột thực thu theo ngày">
    {[min, min + (max - min) / 4, (min + max) / 2, max - (max - min) / 4, max].map(value => <g key={value}>
      <line x1="64" x2="638" y1={y(value)} y2={y(value)} />
      <text x="0" y={y(value) + 4}>{compact.format(value / 100)}</text>
    </g>)}
    {daily.map((d, i) => {
      const x = 66 + slot * (i + .5);
      const bankBase = d.BANK_TRANSFER >= 0 ? Math.max(0, d.CASH) : Math.min(0, d.CASH);
      return <g key={d.date}>
        <title>{d.date} · Tiền mặt {format(d.CASH)} · Chuyển khoản {format(d.BANK_TRANSFER)}</title>
        <rect x={x - width / 2} y={Math.min(y(0), y(d.CASH))} width={width} height={Math.abs(y(0) - y(d.CASH))} fill="var(--rev-cash)" />
        <rect x={x - width / 2} y={Math.min(y(bankBase), y(bankBase + d.BANK_TRANSFER))} width={width}
          height={Math.abs(y(bankBase) - y(bankBase + d.BANK_TRANSFER))} fill="var(--rev-bank)" />
        {i % Math.ceil(daily.length / 7) === 0 && <text x={x} y="234" textAnchor="middle">{d.date.slice(5).split('-').reverse().join('/')}</text>}
      </g>;
    })}
  </svg>;
}
