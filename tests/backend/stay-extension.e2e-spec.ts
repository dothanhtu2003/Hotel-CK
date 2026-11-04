import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createAuthTestApp } from './auth-test-app.js';
import { hotelDay } from '../../src/common/validation/stay-dates.js';
import { PasswordService } from '../../src/auth/password.service.js';

const shift = (n: number) => new Date(Date.parse(hotelDay() + 'T00:00:00Z') + n * 86400000).toISOString().slice(0,10);
describe('Stay extension and room transfer', () => {
  let c: Awaited<ReturnType<typeof createAuthTestApp>>;
  let staffId: string, guestId: string, token: string, guestToken: string;
  beforeAll(async () => {
    c = await createAuthTestApp();
    const passwordHash = await c.app.get(PasswordService).hash(randomUUID());
    const staff = await c.prisma.client.user.create({ data: { fullName: 'Extension receptionist', email: randomUUID()+'@extension.invalid', role: 'RECEPTIONIST', passwordHash } });
    const guest = await c.prisma.client.user.create({ data: { fullName: 'Extension guest', email: randomUUID()+'@extension.invalid', role: 'GUEST', passwordHash } });
    staffId=staff.id; guestId=guest.id;
    token=await c.app.get(JwtService).signAsync({sub:staffId,tokenType:'access'});
    guestToken=await c.app.get(JwtService).signAsync({sub:guestId,tokenType:'access'});
  });
  afterAll(async () => { if(c) await c.app.close(); });
  const api = () => request(c.app.getHttpServer());
  const auth = () => ({ Authorization: 'Bearer '+token });
  async function fixture(conflict = false, paid = false, capacity = 2) {
    const type = await c.prisma.client.roomType.create({ data: { name:'Extension '+randomUUID(), nightlyPrice:'1000', maxGuests:capacity } });
    const room = await c.prisma.client.room.create({ data: { roomNumber:randomUUID().slice(0,12), floor:99, roomTypeId:type.id } });
    const booking = await c.prisma.client.booking.create({ data: { roomId:room.id,userId:guestId,createdById:staffId,checkInDate:new Date(shift(0)),checkOutDate:new Date(shift(1)),guestCount:capacity,onlinePaymentRequired:paid } });
    if(paid){
      const payment=await c.prisma.client.bookingPayment.create({data:{bookingId:booking.id,amount:'1000',payosOrderCode:BigInt('0x'+randomUUID().replaceAll('-','').slice(0,12))}});
      await c.prisma.client.bookingPayment.update({where:{id:payment.id},data:{status:'COMPLETED'}});
    } else await c.prisma.client.booking.update({where:{id:booking.id},data:{status:'CONFIRMED'}});
    await c.prisma.client.booking.update({where:{id:booking.id},data:{status:'CHECKED_IN'}});
    let next;
    if(conflict){ next=await c.prisma.client.booking.create({data:{roomId:room.id,userId:guestId,checkInDate:new Date(shift(1)),checkOutDate:new Date(shift(5)),guestCount:1}}); }
    return {booking,room,type,next};
  }
  const preview = (id:string) => api().post(`/api/bookings/${id}/extension-preview`).set(auth()).send({checkOut:shift(3),expectedCheckOut:shift(1)});
  const payload = (q: {quoteToken:string}, targetRoomId?:string) => ({checkOut:shift(3),expectedCheckOut:shift(1),quoteToken:q.quoteToken,requestId:randomUUID(),...(targetRoomId?{targetRoomId}:{})});
  it('extends in place at the test rate, preserves prepayment and is idempotent',async()=>{
    const {booking,room}=await fixture(false,true);
    const q=await preview(booking.id).expect(201);
    expect(q.body).toMatchObject({conflict:null,overdueAmount:'0.00',extensionAmount:'2000.00',paidAmount:'1000.00',balance:'2000.00'});
    const body=payload(q.body,room.id);
    await api().patch(`/api/bookings/${booking.id}/extend`).set(auth()).send(body).expect(200);
    await api().patch(`/api/bookings/${booking.id}/extend`).set(auth()).send(body).expect(200);
    expect(await c.prisma.client.stayExtension.count({where:{bookingId:booking.id}})).toBe(1);
    const after=await c.prisma.client.booking.findUniqueOrThrow({where:{id:booking.id},include:{bookingPayments:true}});
    expect(after.totalRoomAmount.toFixed(2)).toBe('3000.00');
    expect(after.bookingPayments[0].amount.toFixed(2)).toBe('1000.00');
    expect(after.bookingPayments[0].status).toBe('COMPLETED');
    const invoice=await api().post(`/api/bookings/${booking.id}/invoice`).set(auth()).send({}).expect(201);
    expect(invoice.body.paidAmount).toBe('1000.00'); expect(invoice.body.balance).toBe('2000.00');
  });
  it('transfers into a ready alternative, retaining old stay and leaving booking B untouched',async()=>{
    const {booking,room,type,next}=await fixture(true);
    const target=await c.prisma.client.room.create({data:{roomNumber:randomUUID().slice(0,12),floor:99,roomTypeId:type.id}});
    const dirty=await c.prisma.client.room.create({data:{roomNumber:randomUUID().slice(0,12),floor:99,roomTypeId:type.id,housekeepingStatus:'DIRTY'}});
    const q=await preview(booking.id).expect(201);
    expect(q.body.conflict).toBeTruthy();
    expect(q.body.rooms[0].sameType).toBe(true);
    expect(q.body.rooms.some((r:{id:string})=>r.id===target.id)).toBe(true);
    expect(q.body.rooms.some((r:{id:string})=>r.id===dirty.id)).toBe(false);
    const old=await c.prisma.client.staySegment.findFirstOrThrow({where:{bookingId:booking.id}});
    await api().patch(`/api/bookings/${booking.id}/extend`).set(auth()).send(payload(q.body,target.id)).expect(200);
    const segments=await c.prisma.client.staySegment.findMany({where:{bookingId:booking.id},orderBy:{startedAt:'asc'}});
    expect(segments).toHaveLength(2);expect(segments[0].roomId).toBe(room.id);expect(segments[0].startedAt).toEqual(old.startedAt);
    expect(segments[0].endedAt).toEqual(segments[1].startedAt);expect(segments[1].roomId).toBe(target.id);expect(segments[1].endedAt).toBeNull();
    expect(await c.prisma.client.booking.findUnique({where:{id:next!.id}})).toEqual(next);
    expect((await c.prisma.client.room.findUniqueOrThrow({where:{id:room.id}})).housekeepingStatus).toBe('DIRTY');
    expect(await c.prisma.client.housekeepingTask.count({where:{roomId:room.id,status:'TODO'}})).toBe(1);
    const history=await api().get(`/api/bookings/${booking.id}/stay-history`).set(auth()).expect(200);expect(history.body).toHaveLength(2);
    await expect(c.prisma.client.staySegment.update({where:{id:segments[0].id},data:{startedAt:new Date()}})).rejects.toThrow();
    await expect(c.prisma.client.stayExtension.deleteMany({where:{bookingId:booking.id}})).rejects.toThrow();
  });
  it('does not offer or accept an occupied or dirty target after the quote',async()=>{
    const {booking,type}=await fixture(true);
    const target=await c.prisma.client.room.create({data:{roomNumber:randomUUID().slice(0,12),floor:99,roomTypeId:type.id}});
    const q=await preview(booking.id).expect(201);
    await c.prisma.client.room.update({where:{id:target.id},data:{housekeepingStatus:'DIRTY'}});
    await api().patch(`/api/bookings/${booking.id}/extend`).set(auth()).send(payload(q.body,target.id)).expect(409);
    expect(await c.prisma.client.stayExtension.count({where:{bookingId:booking.id}})).toBe(0);
    expect((await c.prisma.client.booking.findUniqueOrThrow({where:{id:booking.id}})).roomId).toBe(booking.roomId);
  });
  it('rejects transfer when no room has sufficient capacity',async()=>{
    const {booking}=await fixture(true,false,1000000);
    const q=await preview(booking.id).expect(201);expect(q.body.rooms).toEqual([]);
    await api().patch(`/api/bookings/${booking.id}/extend`).set(auth()).send(payload(q.body,booking.roomId)).expect(409);
  });
  it('allows just one of two receptionists to claim the same alternative',async()=>{
    const a=await fixture(true,false,999999),b=await fixture(true,false,999999);
    const target=await c.prisma.client.room.create({data:{roomNumber:randomUUID().slice(0,12),floor:99,roomTypeId:a.type.id}});
    const qa=await preview(a.booking.id).expect(201),qb=await preview(b.booking.id).expect(201);
    const results=await Promise.all([api().patch(`/api/bookings/${a.booking.id}/extend`).set(auth()).send(payload(qa.body,target.id)),api().patch(`/api/bookings/${b.booking.id}/extend`).set(auth()).send(payload(qb.body,target.id))]);
    expect(results.map(r=>r.status).sort()).toEqual([200,409]);
    expect(await c.prisma.client.booking.count({where:{roomId:target.id,status:'CHECKED_IN'}})).toBe(1);
  });
  it('rejects guests and issued invoices without changing the booking',async()=>{
    const {booking}=await fixture();
    await api().post(`/api/bookings/${booking.id}/extension-preview`).set({Authorization:'Bearer '+guestToken}).send({checkOut:shift(3),expectedCheckOut:shift(1)}).expect(403);
    await api().post(`/api/bookings/${booking.id}/invoice`).set(auth()).send({}).expect(201);
    await preview(booking.id).expect(409);
    expect(await c.prisma.client.stayExtension.count({where:{bookingId:booking.id}})).toBe(0);
  });
});
