import { PasswordService } from '../../src/auth/password.service.js';
import { beforeAll, afterAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { createAuthTestApp } from './auth-test-app.js';
import { migrateTestDatabase } from '../database/helpers.js';
import { hotelDay } from '../../src/common/validation/stay-dates.js';

describe('QA audit room readiness, holds and pricing regressions', () => {
 let c: Awaited<ReturnType<typeof createAuthTestApp>>, token:string, guestId:string, staffToken:string;
 const testIp = `198.18.${Math.floor(Math.random()*256)}.${Math.floor(Math.random()*254)+1}`;
 const day=(n:number)=>new Date(Date.parse(hotelDay()+'T00:00Z')+n*86400000).toISOString().slice(0,10);
 beforeAll(async()=>{
  migrateTestDatabase(); c=await createAuthTestApp(1000);
  c.app.getHttpAdapter().getInstance().set('trust proxy',1);
  for(const role of ['GUEST','RECEPTIONIST'] as const){
   const u=await c.prisma.client.user.create({data:{fullName:'QA regression',passwordHash:await c.app.get(PasswordService).hash(randomUUID()),role}});
   const jwt=await c.app.get(JwtService).signAsync({sub:u.id,tokenType:'access'});
   if(role==='GUEST'){guestId=u.id;token=jwt;}else staffToken=jwt;
  }
 },60000);
 afterAll(async()=>{if(c)await c.app.close()});
 const api=()=>request(c.app.getHttpServer());
 async function room(){const t=await c.prisma.client.roomType.create({data:{name:randomUUID(),nightlyPrice:650000,maxGuests:2}});return c.prisma.client.room.create({data:{roomNumber:randomUUID().slice(0,12),floor:88,roomTypeId:t.id}})}
 async function available(id:string){const r=await api().get('/api/rooms/available').query({checkIn:day(0),checkOut:day(1),guests:1}).expect(200);return r.body.data.some((x:{id:string})=>x.id===id)}
 it('does not advertise or accept same-day dirty/open-task rooms; a future stay is still allowed',async()=>{
  const r=await room();await c.prisma.client.housekeepingTask.create({data:{roomId:r.id}});
  expect(await available(r.id)).toBe(false);
  await api().post('/api/bookings').set('X-Forwarded-For',testIp).auth(token,{type:'bearer'}).send({roomId:r.id,checkIn:day(0),checkOut:day(1),guests:1}).expect(409);
  const future=await api().post('/api/bookings').set('X-Forwarded-For',testIp).auth(token,{type:'bearer'}).send({roomId:r.id,checkIn:day(30),checkOut:day(31),guests:1}).expect(201);
  await api().patch(`/api/bookings/${future.body.id}/cancel`).auth(token,{type:'bearer'}).send({}).expect(200);
 });
 it('returns 429 on the third active hold without creating a third booking',async()=>{
  const u=await c.prisma.client.user.create({data:{fullName:'Hold regression',passwordHash:await c.app.get(PasswordService).hash(randomUUID()),role:'GUEST'}});
  const jwt=await c.app.get(JwtService).signAsync({sub:u.id,tokenType:'access'});
  for(let i=0;i<3;i++){const r=await room();await api().post('/api/bookings').set('X-Forwarded-For',testIp).auth(jwt,{type:'bearer'}).send({roomId:r.id,checkIn:day(40),checkOut:day(41),guests:1}).expect(i<2?201:429)}
  expect(await c.prisma.client.booking.count({where:{userId:u.id}})).toBe(2);
 });
 it('preserves the explicitly approved 1000 VND extension rate for a 650000 VND room',async()=>{
  const r=await room();const b=await c.prisma.client.booking.create({data:{userId:guestId,roomId:r.id,checkInDate:new Date(day(0)),checkOutDate:new Date(day(1)),guestCount:1}});
  await c.prisma.client.booking.update({where:{id:b.id},data:{status:'CONFIRMED'}});await c.prisma.client.booking.update({where:{id:b.id},data:{status:'CHECKED_IN'}});
  const q=await api().post(`/api/bookings/${b.id}/extension-preview`).auth(staffToken,{type:'bearer'}).send({expectedCheckOut:day(1),checkOut:day(2)}).expect(201);
  expect(q.body.extensionAmount).toBe('1000.00');expect(q.body.totalRoomAmount).toBe('651000.00');
 });
 it('blocks an overdue occupied room in public search, web booking and walk-in',async()=>{
  const r=await room();const b=await c.prisma.client.booking.create({data:{userId:guestId,roomId:r.id,checkInDate:new Date(day(-2)),checkOutDate:new Date(day(1)),guestCount:1}});
  await c.prisma.client.booking.update({where:{id:b.id},data:{status:'CONFIRMED'}});
  await c.prisma.client.booking.update({where:{id:b.id},data:{status:'CHECKED_IN'}});
  // Synthesize elapsed hotel days only inside the factory-verified local test DB.
  await c.prisma.client.$transaction(async tx=>{
   await tx.$executeRawUnsafe('ALTER TABLE hotel.bookings DISABLE TRIGGER guard_bookings');
   await tx.$executeRaw`UPDATE hotel.bookings SET check_out_date=${new Date(day(-1))}::date WHERE id=${b.id}::uuid`;
   await tx.$executeRawUnsafe('ALTER TABLE hotel.bookings ENABLE TRIGGER guard_bookings');
  });
  expect(await available(r.id)).toBe(false);
  await api().post('/api/bookings').auth(token,{type:'bearer'}).send({roomId:r.id,checkIn:day(0),checkOut:day(1),guests:1}).expect(409);
  await api().post('/api/front-desk/walk-in').auth(staffToken,{type:'bearer'}).send({roomId:r.id,customerId:guestId,receiveNow:false,checkIn:day(0),checkOut:day(1),guests:1}).expect(409);
 });
 it('resells an early checkout only after housekeeping has made the room clean',async()=>{
  const r=await room();const b=await c.prisma.client.booking.create({data:{userId:guestId,roomId:r.id,checkInDate:new Date(day(0)),checkOutDate:new Date(day(3)),guestCount:1}});
  await c.prisma.client.booking.update({where:{id:b.id},data:{status:'CONFIRMED'}});
  await c.prisma.client.booking.update({where:{id:b.id},data:{status:'CHECKED_IN'}});
  const inv=await api().post(`/api/bookings/${b.id}/invoice`).auth(staffToken,{type:'bearer'}).send({}).expect(201);
  await api().post(`/api/invoices/${inv.body.id}/payments`).auth(staffToken,{type:'bearer'}).set('Idempotency-Key',randomUUID()).send({amount:inv.body.totalAmount,method:'CASH'}).expect(201);
  await api().patch(`/api/bookings/${b.id}/check-out`).auth(staffToken,{type:'bearer'}).send({}).expect(200);
  expect(await available(r.id)).toBe(false);
  await api().patch(`/api/front-desk/rooms/${r.id}/condition`).auth(staffToken,{type:'bearer'}).send({condition:'CLEAN',expectedOperationalStatus:'ACTIVE',expectedHousekeepingStatus:'DIRTY',completeOpenTasks:true}).expect(200);
  expect(await available(r.id)).toBe(true);
  await api().post('/api/bookings').set('X-Forwarded-For',testIp).auth(token,{type:'bearer'}).send({roomId:r.id,checkIn:day(0),checkOut:day(1),guests:1}).expect(201);
 });
});
