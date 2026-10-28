import 'dotenv/config';
import { createHash, randomBytes, scryptSync } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { createPrismaClient } from '../src/database/client.js';

export function demoId(key: string) {
  const h = createHash('sha256').update(`hotel-ck-demo:${key}`).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}
function day(offset: number) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const d = new Date(`${today}T00:00:00Z`); d.setUTCDate(d.getUTCDate()+offset); return d;
}
if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEMO_SEED !== 'true') throw new Error('Demo seed requires ALLOW_DEMO_SEED=true and non-production environment');
const db = createPrismaClient();
try {
  mkdirSync('.local', { recursive: true });
  const passwordFile = '.local/demo-password.txt';
  const password = process.env.DEMO_PASSWORD || (existsSync(passwordFile) ? readFileSync(passwordFile,'utf8').trim() : randomBytes(24).toString('base64url'));
  if (password.length < 16) throw new Error('DEMO_PASSWORD requires at least 16 characters');
  if (!process.env.DEMO_PASSWORD && !existsSync(passwordFile)) writeFileSync(passwordFile,password,{ mode: 0o600 });
  const salt = randomBytes(16).toString('hex');
  const passwordHash = `scrypt$${salt}$${scryptSync(password,salt,64,{ N:16384, r:8, p:1 }).toString('hex')}`;
  await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(6142026)`;
    const marker = await tx.booking.findUnique({ where: { reference: 'DEMO-CHECKED-OUT' } });
    if (marker) {
      const users = await tx.user.count({ where: { email: { endsWith: '@demo.hotel.invalid' } } });
      const rooms = await tx.room.count({ where: { id: { in: Array.from({length:12},(_,i)=>demoId(`room:${i}`)) } } });
      const bookings = await tx.booking.count({ where: { reference: { startsWith: 'DEMO-' } } });
      const types = await tx.roomType.count({where:{id:{in:[0,1,2].map(i=>demoId(`type:${i}`))}}});
      const services = await tx.service.count({where:{id:{in:[0,1,2,3,4].map(i=>demoId(`service:${i}`))}}});
      const orders = await tx.serviceOrder.count({where:{booking:{reference:{startsWith:'DEMO-'}}}});
      const invoices = await tx.invoice.count({where:{bookingId:marker.id}});
      if (users !== 10 || rooms !== 12 || bookings !== 7 || types !== 3 || services !== 5 || orders !== 3 || invoices !== 1) throw new Error('Demo dataset changed; inspect manually, seed will not overwrite history');
      console.log('Demo seed already present; no records changed.');
      return;
    }
    const roles = ['ADMIN','RECEPTIONIST','RECEPTIONIST','HOUSEKEEPING','HOUSEKEEPING','GUEST','GUEST','GUEST','GUEST','GUEST'] as const;
    const names = ['Nguyễn Minh An','Trần Thu Hà','Lê Quang Huy','Phạm Thị Lan','Võ Thanh Bình','Đặng Ngọc Mai','Bùi Hoàng Nam','Đỗ Thảo Vy','Hoàng Đức Anh','Ngô Kim Chi'];
    for (let i=0;i<roles.length;i++) await tx.user.create({ data: { id: demoId(`user:${i}`), fullName:names[i], email:`user${i}@demo.hotel.invalid`, passwordHash, phone:`09012345${i.toString().padStart(2,'0')}`, role:roles[i] } });
    const types = [{name:'Standard',price:650000,max:2},{name:'Deluxe',price:1000000,max:3},{name:'Suite',price:1800000,max:4}];
    for (let i=0;i<types.length;i++) await tx.roomType.create({ data: { id:demoId(`type:${i}`),name:types[i].name,description:`Phòng ${types[i].name}`,nightlyPrice:types[i].price,maxGuests:types[i].max } });
    for (let i=0;i<12;i++) {
      await tx.room.create({ data: { id:demoId(`room:${i}`),roomNumber:`${Math.floor(i/4)+1}0${i%4+1}`,floor:Math.floor(i/4)+1,roomTypeId:demoId(`type:${Math.floor(i/4)}`) } });
    }
    // Cloudinary URLs are optional: do not invent assets or upload without configuration.
    const serviceNames = ['Bữa sáng','Cà phê','Giặt ủi','Nước suối','Bữa tối'];
    const prices = [120000,45000,80000,20000,200000];
    for (let i=0;i<5;i++) await tx.service.create({ data: { id:demoId(`service:${i}`),name:serviceNames[i],description:'Dịch vụ tại khách sạn',currentPrice:prices[i] } });
    const specs = [
      {key:'CHECKED-OUT',room:0,start:-10,end:-7,status:'CHECKED_IN'},
      {key:'CONFIRMED',room:1,start:10,end:13,status:'CONFIRMED'},
      {key:'PENDING',room:2,start:14,end:16,status:'PENDING'},
      {key:'CANCELLED',room:3,start:10,end:12,status:'CANCELLED'},
      {key:'IN-HOUSE',room:4,start:-1,end:3,status:'CHECKED_IN'},
      {key:'ADJACENT',room:1,start:13,end:15,status:'CONFIRMED'},
      {key:'REBOOKED',room:3,start:10,end:12,status:'CONFIRMED'},
    ] as const;
    for (const [i,s] of specs.entries()) {
      // Checked-out history is created through today's legitimate transitions first.
      const history = s.key==='CHECKED-OUT';
      await tx.booking.create({ data: { id:demoId(`booking:${s.key}`),reference:`DEMO-${s.key}`,userId:demoId(`user:${5+i%5}`),roomId:demoId(`room:${s.room}`),checkInDate:day(history?-3:s.start),checkOutDate:day(history?1:s.end),guestCount:2 } });
      if (s.status!=='PENDING' && s.status!=='CANCELLED') await tx.booking.update({where:{id:demoId(`booking:${s.key}`)},data:{status:'CONFIRMED'}});
      if (s.status==='CANCELLED') await tx.booking.update({where:{id:demoId(`booking:${s.key}`)},data:{status:'CANCELLED'}});
      if (s.status==='CHECKED_IN') await tx.booking.update({where:{id:demoId(`booking:${s.key}`)},data:{status:'CHECKED_IN'}});
    }
    for (const [i,key] of ['CHECKED-OUT','IN-HOUSE'].entries()) {
      const order = await tx.serviceOrder.create({data:{id:demoId(`order:${i}`),bookingId:demoId(`booking:${key}`)}});
      for (let j=0;j<2;j++) await tx.serviceOrderItem.create({data:{serviceOrderId:order.id,serviceId:demoId(`service:${j}`),quantity:j+1}});
      await tx.serviceOrder.update({where:{id:order.id},data:{status:'COMPLETED'}});
    }
    const cancelled = await tx.serviceOrder.create({data:{bookingId:demoId('booking:IN-HOUSE')}});
    await tx.serviceOrderItem.create({data:{serviceOrderId:cancelled.id,serviceId:demoId('service:4'),quantity:1}});
    await tx.serviceOrder.update({where:{id:cancelled.id},data:{status:'CANCELLED'}});
    const bid = demoId('booking:CHECKED-OUT');
    const invoice = await tx.invoice.create({data:{bookingId:bid}});
    await tx.payment.create({data:{invoiceId:invoice.id,amount:invoice.totalAmount,method:'CASH',status:'COMPLETED'}});
    await tx.booking.update({where:{id:bid},data:{status:'CHECKED_OUT'}});
    const task = await tx.housekeepingTask.findFirstOrThrow({where:{roomId:demoId('room:0'),status:'TODO'}});
    await tx.housekeepingTask.update({where:{id:task.id},data:{assignedStaffId:demoId('user:3'),status:'IN_PROGRESS'}});
    await tx.housekeepingTask.update({where:{id:task.id},data:{status:'DONE'}});
    await tx.housekeepingTask.create({data:{roomId:demoId('room:10'),assignedStaffId:demoId('user:4'),notes:'Vệ sinh phòng trước khi đón khách'}});
    const cleaning = await tx.housekeepingTask.create({data:{roomId:demoId('room:11'),assignedStaffId:demoId('user:3')}});
    await tx.housekeepingTask.update({where:{id:cleaning.id},data:{status:'IN_PROGRESS'}});
  }, { timeout: 60000 });
  console.log('Demo seed verified. Demo password is supplied by environment or stored only in .local/demo-password.txt.');
} finally { await db.$disconnect(); }
