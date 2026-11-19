// Reuse the real Nest application and its existing isolated test-DB factory.
// No new API, mock transport, migration, reset or hotel_dev mutation is introduced.
import 'reflect-metadata';
import { createDatabase, dropDatabase } from './e2e-database.mjs';
import { providerClient } from './e2e-provider.mjs';
import { fileURLToPath, URL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const root = fileURLToPath(new URL('../../', import.meta.url));
process.chdir(root);
mkdirSync('.local',{recursive:true});
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGINS = 'http://localhost:5174,http://127.0.0.1:5174';
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.test.json'], { cwd: root, stdio: 'pipe' });
const { createAuthTestApp } = await import('../../dist-tests/tests/backend/auth-test-app.js');
const { PasswordService } = await import('../../dist-tests/src/auth/password.service.js');
const database = await createDatabase();
process.env.TEST_DATABASE_URL = database.url;
const context = await createAuthTestApp(1000, [], { disposableDatabase:database.name }).catch(async error=>{await dropDatabase(database.name);throw error;});
try {
const { PayosService } = await import('../../dist-tests/src/billing/payos.service.js');
const { ConfigService } = await import('@nestjs/config');
context.app.get(ConfigService).set('PAYOS_RETURN_ORIGIN', 'http://localhost:5174');
Object.defineProperty(context.app.get(PayosService), 'client', { value: () => simulatedProvider });
const simulatedProvider = providerClient(root + '.local/e2e-provider-state.json');
const password = `Frontend-A1-${randomUUID()}`;
const hash = await context.app.get(PasswordService).hash(password);
const users = {};
for (const [name, role] of [['guest', 'GUEST'], ['reception', 'RECEPTIONIST'], ['housekeeping', 'HOUSEKEEPING'], ['admin', 'ADMIN'], ['expired', 'GUEST'], ['disabled', 'GUEST'], ['deskExpired', 'RECEPTIONIST'], ['hkOther', 'HOUSEKEEPING'], ['hkEmpty', 'HOUSEKEEPING'], ['hkInactive', 'HOUSEKEEPING'], ['hkExpired', 'HOUSEKEEPING']]) {
  const user = await context.prisma.client.user.create({ data: { fullName: `Frontend ${name}`, email: `${randomUUID()}@frontend-test.invalid`, passwordHash: hash, role, status: ['disabled', 'hkInactive'].includes(name) ? 'DISABLED' : 'ACTIVE' } });
  users[name] = { id: user.id, email: user.email, role, fullName: user.fullName };
}
// Additive fixtures are created only after createAuthTestApp verifies hotel_test.
const suffix = randomUUID().slice(0, 8);
const roomType = await context.prisma.client.roomType.create({ data: { name: `Frontend ${suffix}`, description: 'Phòng kiểm thử website', nightlyPrice: '650000.25', maxGuests: 4 } });
const room = await context.prisma.client.room.create({ data: { roomNumber: `FE${suffix}`, floor: 1, roomTypeId: roomType.id } });
const secondRoom = await context.prisma.client.room.create({ data: { roomNumber: `FS${suffix}`, floor: 1, roomTypeId: roomType.id } });
const services = [];
for (const [index, price] of ['45000.25', '80000.50'].entries()) services.push(await context.prisma.client.service.create({ data: { name: `Frontend ${suffix} ${index}`, description: 'Dịch vụ kiểm thử', currentPrice: price } }));
const deskType = await context.prisma.client.roomType.create({ data: { name: `Front Desk ${suffix}`, description: 'Phòng kiểm thử lễ tân', nightlyPrice: '650000.25', maxGuests: 4 } });
const deskRooms = [];
for (let i = 0; i < 10; i++) deskRooms.push(await context.prisma.client.room.create({ data: { roomNumber: `FD${i}${suffix}`, floor: 2, roomTypeId: deskType.id } }));
// Non-overlapping, additive pending bookings ensure the desk pagination is exercised.
for (let i = 0; i < 12; i++) {
  const checkInDate = new Date(Date.UTC(2041, 0, 1 + i * 3)), checkOutDate = new Date(Date.UTC(2041, 0, 3 + i * 3));
  await context.prisma.client.booking.create({ data: { userId: users.guest.id, roomId: deskRooms[6].id, checkInDate, checkOutDate, guestCount: 2 } });
}
const hkType = await context.prisma.client.roomType.create({ data: { name: `Housekeeping ${suffix}`, nightlyPrice: '100000.25', maxGuests: 2 } });
const hkRooms = [], hkTasks = [];
for (let i = 0; i < 21; i++) hkRooms.push(await context.prisma.client.room.create({ data: { roomNumber: `HK${String(i).padStart(2, '0')}${suffix}`, floor: 3, roomTypeId: hkType.id, housekeepingStatus:[16,17].includes(i)?'DIRTY':'CLEAN' } }));
for (let i = 0; i < 16; i++) hkTasks.push(await context.prisma.client.housekeepingTask.create({ data: { roomId: hkRooms[i].id, assignedStaffId: i < 14 ? users.housekeeping.id : i === 14 ? users.hkOther.id : null, notes: `Công việc kiểm thử ${i}` } }));
// Follow trigger-allowed transitions; never force cleanliness or insert a DONE task.
for (const index of [12, 13]) await context.prisma.client.housekeepingTask.update({ where: { id: hkTasks[index].id }, data: { status: 'IN_PROGRESS' } });
await context.prisma.client.housekeepingTask.update({ where: { id: hkTasks[13].id }, data: { status: 'DONE' } });
const housekeeping = { rooms: hkRooms, tasks: hkTasks };
const counterType = await context.prisma.client.roomType.create({ data: { name: `Counter ${suffix}`, nightlyPrice:'650000.00', maxGuests:4 } });
const counterRooms = [];
for(let i=0;i<3;i++) counterRooms.push(await context.prisma.client.room.create({ data:{ roomTypeId:counterType.id, roomNumber:`CW${i}${suffix}`, floor:2 } }));
const releaseType = await context.prisma.client.roomType.create({ data: { name: `Release ${suffix}`, nightlyPrice: '650000.00', maxGuests: 2 } });
const releaseRoom = await context.prisma.client.room.create({ data: { roomNumber: `R9${suffix}`, floor: 4, roomTypeId: releaseType.id } });
mkdirSync('.local', { recursive: true });
writeFileSync('.local/frontend-e2e-fixtures.json', JSON.stringify({ databaseName:database.name, users, password, room, secondRoom, roomType, services, deskRooms, counterRooms, housekeeping, releaseRoom, releaseType }), { mode: 0o600 });
await context.app.listen(3301, '127.0.0.1');
console.log('Frontend E2E: real Nest backend on 127.0.0.1:3301, verified disposable E2E database.');
let closing = false;
const close = async () => { if (closing) return; closing = true; await context.app.close(); await dropDatabase(database.name); process.exit(0); };
process.on('SIGTERM', close); process.on('SIGINT', close);

} catch(error) { await context.app.close();await dropDatabase(database.name);throw error; }
