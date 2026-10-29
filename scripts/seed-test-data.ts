import 'dotenv/config';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { hash } from 'argon2';
import { createPrismaClient } from '../src/database/client.js';

// Additive fixtures: never reset a database or rewrite a stay the tester has changed.
const url = new URL(process.env.DATABASE_URL ?? '');
if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEMO_SEED !== 'true'
  || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== '/hotel_dev') {
  throw new Error('Test data requires local hotel_dev, ALLOW_DEMO_SEED=true, and non-production mode');
}
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
const batch = today.replaceAll('-', '');
const prefix = `TEST-${batch}`;
const id = (key: string) => {
  const h = createHash('sha256').update(`hotel-ck-test:${batch}:${key}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const day = (offset: number) => {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};
mkdirSync('.local', { recursive: true });
const passwordPath = '.local/test-data-password.txt';
const password = existsSync(passwordPath) ? readFileSync(passwordPath, 'utf8').trim() : randomBytes(24).toString('base64url');
if (password.length < 16 || password.length > 128) throw new Error('Invalid local test password');
if (!existsSync(passwordPath)) writeFileSync(passwordPath, password, { mode: 0o600, flag: 'wx' });
const passwordHash = await hash(password);
const staff = [
  { key: 'admin', name: 'Nguyễn Minh Quân', role: 'ADMIN' },
  { key: 'reception', name: 'Trần Thu Hà', role: 'RECEPTIONIST' },
  { key: 'reception2', name: 'Lê Hoàng Phúc', role: 'RECEPTIONIST' },
  { key: 'housekeeping', name: 'Phạm Thị Lan', role: 'HOUSEKEEPING' },
  { key: 'housekeeping2', name: 'Võ Thanh Bình', role: 'HOUSEKEEPING' },
  { key: 'housekeeping3', name: 'Đỗ Ngọc Ánh', role: 'HOUSEKEEPING' },
] as const;
const guestNames = [
  'Nguyễn Ngọc Mai', 'Trần Hoàng Nam', 'Lê Thảo Vy', 'Phạm Đức Anh', 'Hoàng Kim Chi',
  'Đặng Minh Khang', 'Bùi Thanh Tâm', 'Đỗ Bảo Ngọc', 'Vũ Gia Huy', 'Ngô Khánh Linh',
  'Dương Hải Đăng', 'Phan Thu Trang', 'Lý Quang Vinh', 'Mai Phương Anh', 'Cao Tuấn Kiệt',
  'Hồ Mỹ Duyên', 'Đinh Anh Tuấn', 'Trương Ngọc Hân', 'Tạ Minh Châu', 'Lâm Quốc Bảo',
  'Võ Thùy Dung', 'Nguyễn Thành Đạt', 'Trần Bích Ngọc', 'Lê Nhật Minh', 'Alex Morgan', 'Khách bị khóa',
];
const types = [
  { name: 'Single', price: 450000, capacity: 1 },
  { name: 'Standard', price: 650000, capacity: 2 },
  { name: 'Deluxe', price: 1000000, capacity: 3 },
  { name: 'Family', price: 1500000, capacity: 4 },
  { name: 'Suite', price: 2400000, capacity: 6 },
];
const services = [
  ['Bữa sáng', 120000], ['Cà phê', 45000], ['Giặt ủi', 80000], ['Nước suối', 20000],
  ['Bữa tối', 200000], ['Đưa đón sân bay', 350000], ['Minibar', 65000], ['Massage', 400000],
  ['Trái cây', 95000], ['Giường phụ', 250000], ['Trà chào mừng', 0], ['Dịch vụ tạm ngừng', 150000],
] as const;
const bookingRows: { reference: string; room: string; scenario: string }[] = [];
const roomNumber = (i: number) => `T${batch.slice(2)}-${Math.floor(i / 6) + 1}0${i % 6 + 1}`;
const db = createPrismaClient();
try {
  const created = await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(29102026)`;
    const marker = await tx.booking.findUnique({ where: { reference: `${prefix}-STAY-01` } });
    if (marker) return false;
    for (const s of staff) await tx.user.create({ data: {
      id: id(`staff:${s.key}`), fullName: s.name, email: `${s.key}.${batch}@test.hotel.invalid`,
      passwordHash, role: s.role, phone: null,
    } });
    for (const [i, name] of guestNames.entries()) await tx.user.create({ data: {
      id: id(`guest:${i}`), fullName: name, email: `guest${i + 1}.${batch}@test.hotel.invalid`,
      passwordHash, phone: `08${batch.slice(2)}${String(i).padStart(2, '0')}`,
      status: i === 25 ? 'DISABLED' : 'ACTIVE',
    } });
    for (const [i, t] of types.entries()) await tx.roomType.create({ data: {
      id: id(`type:${i}`), name: `${prefix} ${t.name}`, nightlyPrice: t.price, maxGuests: t.capacity,
      description: `Dữ liệu test ${today}: phòng ${t.name}, tối đa ${t.capacity} khách.`,
    } });
    for (let i = 0; i < 30; i++) await tx.room.create({ data: {
      id: id(`room:${i}`), roomNumber: roomNumber(i), floor: Math.floor(i / 6) + 1,
      roomTypeId: id(`type:${Math.floor(i / 6)}`),
      operationalStatus: i >= 28 ? 'OUT_OF_SERVICE' : 'ACTIVE',
    } });
    for (const [i, [name, price]] of services.entries()) await tx.service.create({ data: {
      id: id(`service:${i}`), name: `${prefix} ${name}`, currentPrice: price, isActive: i !== 11,
      description: `Dịch vụ mẫu để kiểm thử, đợt ${today}`,
    } });
    const booking = async (key: string, room: number, start: number, end: number,
      state: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CANCELLED', guest: number, scenario: string) => {
      const b = await tx.booking.create({ data: {
        id: id(`booking:${key}`), reference: `${prefix}-${key}`, userId: id(`guest:${guest % 25}`),
        roomId: id(`room:${room}`), checkInDate: day(start), checkOutDate: day(end),
        guestCount: 1 + guest % types[Math.floor(room / 6)].capacity,
        createdById: guest % 2 === 0 ? id('staff:reception') : null,
      } });
      if (state === 'CANCELLED') await tx.booking.update({ where: { id: b.id }, data: { status: 'CANCELLED' } });
      if (state === 'CONFIRMED' || state === 'CHECKED_IN') await tx.booking.update({ where: { id: b.id }, data: { status: 'CONFIRMED' } });
      if (state === 'CHECKED_IN') await tx.booking.update({ where: { id: b.id }, data: { status: 'CHECKED_IN' } });
      bookingRows.push({ reference: b.reference, room: roomNumber(room), scenario });
      return b;
    };
    for (let i = 0; i < 12; i++) {
      const key = `STAY-${String(i + 1).padStart(2, '0')}`;
      const scenario = i < 6 ? 'Đang ở; xử lý dịch vụ / lập hóa đơn'
        : i === 6 ? 'Hóa đơn chưa thanh toán' : i === 7 ? 'Thanh toán một phần'
          : i < 10 ? 'Đã thanh toán đủ, chờ trả phòng' : 'Đã trả phòng, task tự sinh';
      const b = await booking(key, i, -(i % 3), 1 + i % 4, 'CHECKED_IN', i, scenario);
      for (let j = 0; j < (i < 6 ? 3 : 2); j++) {
        const order = await tx.serviceOrder.create({ data: { bookingId: b.id } });
        for (let k = 0; k < 2; k++) await tx.serviceOrderItem.create({ data: {
          serviceOrderId: order.id, serviceId: id(`service:${(i + j + k) % 11}`), quantity: k + 1,
        } });
        if (j !== 2) await tx.serviceOrder.update({ where: { id: order.id }, data: { status: j === 0 ? 'COMPLETED' : 'CANCELLED' } });
      }
      if (i >= 6) {
        const inv = await tx.invoice.create({ data: { bookingId: b.id } });
        const total = Number(inv.totalAmount);
        if (i === 6) {
          await tx.payment.create({ data: { invoiceId: inv.id, amount: 100000, method: 'BANK_TRANSFER', status: 'FAILED' } });
          await tx.payment.create({ data: { invoiceId: inv.id, amount: 100000, method: 'BANK_TRANSFER', status: 'PENDING' } });
        }
        if (i >= 7) await tx.payment.create({ data: {
          invoiceId: inv.id, amount: Math.floor(total / 2), method: 'CASH', status: 'COMPLETED',
        } });
        if (i >= 8) await tx.payment.create({ data: {
          invoiceId: inv.id, amount: total - Math.floor(total / 2), method: 'BANK_TRANSFER', status: 'COMPLETED',
        } });
        if (i >= 10) await tx.booking.update({ where: { id: b.id }, data: { status: 'CHECKED_OUT' } });
      }
    }
    for (let i = 12; i < 18; i++) await booking(`ARRIVAL-${i - 11}`, i, 0, 2 + i % 3,
      i % 2 === 0 ? 'CONFIRMED' : 'PENDING', i, 'Đến hôm nay; phòng 16/17 có task chặn nhận phòng');
    for (let i = 18; i < 24; i++) await booking(`FUTURE-${i - 17}`, i, 1 + i % 4, 6 + i % 4,
      i % 2 === 0 ? 'CONFIRMED' : 'PENDING', i, 'Đặt trước / kiểm tra phòng trống');
    await booking('ADJACENT', 18, 8, 10, 'CONFIRMED', 24, 'Nối tiếp FUTURE-1, không trùng đêm');
    for (let i = 24; i < 28; i++) {
      await booking(`CANCELLED-${i - 23}`, i, 2, 5, 'CANCELLED', i, 'Đã hủy, không giữ chỗ');
      await booking(`REBOOK-${i - 23}`, i, 2, 5, 'CONFIRMED', i + 1, 'Đặt lại đúng khoảng ngày của booking đã hủy');
    }
    for (const [n, room] of [10, 11, 16, 17, 24, 25, 26, 27].entries()) {
      let task = await tx.housekeepingTask.findFirst({ where: { roomId: id(`room:${room}`), status: 'TODO' } });
      const assignedStaffId = n === 4 ? null : id(`staff:${n % 2 === 0 ? 'housekeeping' : 'housekeeping2'}`);
      if (!task) task = await tx.housekeepingTask.create({ data: {
        roomId: id(`room:${room}`), assignedStaffId, notes: `${prefix}: ${room === 16 || room === 17 ? 'Dọn trước khi khách đến' : 'Vệ sinh phòng mẫu'}`,
      } });
      else task = await tx.housekeepingTask.update({ where: { id: task.id }, data: { assignedStaffId } });
      if (n % 3 !== 1 && assignedStaffId) await tx.housekeepingTask.update({ where: { id: task.id }, data: { status: 'IN_PROGRESS' } });
      if (room === 10) await tx.housekeepingTask.update({ where: { id: task.id }, data: { status: 'DONE' } });
    }
    return true;
  }, { timeout: 60000 });

  const bookings = await db.booking.findMany({ where: { reference: { startsWith: `${prefix}-` } }, include: { room: true, invoice: { include: { payments: true } }, serviceOrders: true } });
  const report = {
    batch: prefix, created, day: today,
    counts: {
      users: await db.user.count({ where: { email: { endsWith: `.${batch}@test.hotel.invalid` } } }),
      rooms: await db.room.count({ where: { id: { in: Array.from({ length: 30 }, (_, i) => id(`room:${i}`)) } } }),
      roomTypes: 5, services: 12, bookings: bookings.length,
      serviceOrders: bookings.reduce((n, b) => n + b.serviceOrders.length, 0),
      invoices: bookings.filter(b => b.invoice).length,
      payments: bookings.reduce((n, b) => n + (b.invoice?.payments.length ?? 0), 0),
      housekeepingTasks: await db.housekeepingTask.count({ where: { roomId: { in: Array.from({ length: 30 }, (_, i) => id(`room:${i}`)) } } }),
    },
    accounts: [...staff.map(s => ({ role: s.role, email: `${s.key}.${batch}@test.hotel.invalid` })),
      { role: 'GUEST', email: `guest1.${batch}@test.hotel.invalid` },
      { role: 'GUEST (DISABLED)', email: `guest26.${batch}@test.hotel.invalid` }],
    passwordFile: passwordPath,
    scenarios: created ? bookingRows : 'Already seeded; existing tester changes preserved. See booking references in database.',
    notes: [
      'All dates use Asia/Ho_Chi_Minh. No existing data is reset or overwritten.',
      'Checkout fixtures represent early checkout today; database guards prohibit fabricating past transitions.',
      'Departures today requires a stay checked in before today. Keep fixtures until tomorrow to exercise it.',
      'Room images are not fabricated; valid configured Cloudinary assets are required by the database.',
    ],
  };
  if (created || !existsSync(`.local/test-data-${batch}.json`)) writeFileSync(`.local/test-data-${batch}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ batch: prefix, created, counts: report.counts, report: `.local/test-data-${batch}.json`, passwordFile: passwordPath }, null, 2));
} finally { await db.$disconnect(); }
