import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { randomUUID } from "node:crypto";
import { JwtService } from "@nestjs/jwt";
import request from "supertest";
import { PasswordService } from "../../src/auth/password.service.js";
import { createAuthTestApp } from "./auth-test-app.js";
import { hotelDay } from "../../src/front-desk/front-desk.service.js";

describe("Front desk API — isolated local hotel_test", () => {
  let c: Awaited<ReturnType<typeof createAuthTestApp>>;
  const actors = {} as Record<
    string,
    { id: string; token: string; email: string }
  >;
  let typeId: string;
  const run = randomUUID();
  const today = hotelDay(),
    tomorrow = new Date(Date.parse(today + "T00:00:00Z") + 86400000)
      .toISOString()
      .slice(0, 10);
  const api = () => request(c.app.getHttpServer());
  const auth = (who = "desk") => ({
    Authorization: "Bearer " + actors[who].token,
  });
  beforeAll(async () => {
    c = await createAuthTestApp();
    const passwordHash = await c.app.get(PasswordService).hash(randomUUID());
    for (const [key, role] of [
      ["desk", "RECEPTIONIST"],
      ["admin", "ADMIN"],
      ["guest", "GUEST"],
      ["hk", "HOUSEKEEPING"],
    ] as const) {
      const u = await c.prisma.client.user.create({
        data: {
          fullName: "Desk customer " + run,
          email: key + "-" + run + "@desk-test.invalid",
          phone: key === "guest" ? "09" + run.slice(0, 8) : null,
          role,
          passwordHash,
        },
      });
      actors[key] = {
        id: u.id,
        email: u.email,
        token: await c.app
          .get(JwtService)
          .signAsync({ sub: u.id, tokenType: "access" }),
      };
    }
    typeId = (
      await c.prisma.client.roomType.create({
        data: { name: "Desk " + run, nightlyPrice: "123456.75", maxGuests: 3 },
      })
    ).id;
  });
  afterAll(async () => {
    if (c) await c.app.close();
  });
  async function room(dirty = false) {
    return c.prisma.client.room.create({
      data: {
        roomNumber: randomUUID().slice(0, 12),
        floor: 8,
        roomTypeId: typeId,
        housekeepingStatus: dirty ? "DIRTY" : "CLEAN",
      },
    });
  }
  const body = (roomId: string) => ({
    roomId,
    checkIn: today,
    checkOut: tomorrow,
    guests: 2,
    customerId: actors.guest.id,
  });
  async function create(roomId: string) {
    return (
      await api()
        .post("/api/front-desk/walk-in")
        .set(auth())
        .send(body(roomId))
        .expect(201)
    ).body;
  }
  it("reads future tape ranges with half-open boundaries and operational dates", async () => {
    const r = await room();
    const booking = await c.prisma.client.booking.create({ data: { roomId: r.id, userId: actors.guest.id, checkInDate: new Date('2048-06-01'), checkOutDate: new Date('2048-06-04'), guestCount: 2 } });
    const range = await api().get(`/api/front-desk/rooms?roomTypeId=${typeId}&start=2048-06-02&end=2048-06-05&pageSize=100`).set(auth()).expect(200);
    expect(range.body.data.find((v: { id: string }) => v.id === r.id).bookings.map((v: { id: string }) => v.id)).toContain(booking.id);
    const after = await api().get(`/api/front-desk/rooms?roomTypeId=${typeId}&start=2048-06-04&end=2048-06-05&pageSize=100`).set(auth()).expect(200);
    expect(after.body.data.find((v: { id: string }) => v.id === r.id).bookings).toHaveLength(0);
    const arrivals = await api().get('/api/front-desk/bookings?view=arrivals&date=2048-06-01&pageSize=100').set(auth()).expect(200);
    expect(arrivals.body.data.map((v: { id: string }) => v.id)).toContain(booking.id);
    for (const range of ['start=2048-06-01', 'start=2048-06-01&end=2048-06-01', 'start=2048-06-01&end=2048-08-01', 'start=2048-02-30&end=2048-03-04']) await api().get('/api/front-desk/rooms?' + range).set(auth()).expect(400);
    const metrics = await api().get('/api/front-desk/dashboard').set(auth()).expect(200);
    expect(metrics.body.totalRooms).toBe(await c.prisma.client.room.count());
    expect(metrics.body.occupiedRooms).toBe(await c.prisma.client.room.count({ where: { bookings: { some: { status: 'CHECKED_IN' } } } }));
    expect(metrics.body.openTasks).toBe(await c.prisma.client.housekeepingTask.count({ where: { status: { not: 'DONE' } } }));
  });
  it("protects every endpoint and private customer information", async () => {
    for (const route of [
      "dashboard",
      "bookings",
      "rooms",
      "room-filters",
      "customers?q=Desk",
      "orders",
      "available?checkIn=" + today + "&checkOut=" + tomorrow + "&guests=2",
    ]) {
      await api()
        .get("/api/front-desk/" + route)
        .expect(401);
      for (const who of ["guest", "hk"])
        await api()
          .get("/api/front-desk/" + route)
          .set(auth(who))
          .expect(403);
      await api()
        .get("/api/front-desk/" + route)
        .set(auth("admin"))
        .expect(200);
    }
    for (const who of ["guest", "hk"])
      await api()
        .post("/api/front-desk/walk-in")
        .set(auth(who))
        .send({})
        .expect(403);
  });
  it("links an existing account without creating accounts or sessions and records the staff creator", async () => {
    const r = await room(),
      before = await c.prisma.client.user.count(),
      b = await create(r.id);
    expect(b.userId).toBe(actors.guest.id);
    expect(b.customer.fullName).toContain(run);
    expect(b.reference).toMatch(/^CK-/);
    expect(b.totalRoomAmount).toBe("123456.75");
    expect(b.status).toBe("PENDING");
    expect(b).not.toHaveProperty("accessToken");
    expect(await c.prisma.client.user.count()).toBe(before);
    const stored = await c.prisma.client.booking.findUniqueOrThrow({
      where: { id: b.id },
    });
    expect(stored.createdById).toBe(actors.desk.id);
    const detail = await api()
      .get("/api/front-desk/bookings/" + b.id)
      .set(auth())
      .expect(200);
    expect(detail.body.customer.email).toBe(actors.guest.email);
    expect(detail.text).not.toMatch(/passwordHash|password_hash/);
    await api()
      .get("/api/front-desk/bookings/" + b.id)
      .set(auth("guest"))
      .expect(403);
    // Guest API remains free of personal details introduced for staff.
    const guest = await api()
      .get("/api/bookings/" + b.id)
      .set(auth("guest"))
      .expect(200);
    expect(guest.text).not.toMatch(/email|phone|customer/);
  });
  it("creates a new guest with an unexposed random password hash; refuses duplicate typed identities", async () => {
    const r = await room(),
      email = "new-" + run + "@desk-test.invalid",
      phone = "08" + run.slice(0, 8),
      payload = {
        roomId: r.id,
        checkIn: today,
        checkOut: tomorrow,
        guests: 1,
        fullName: "New " + run,
        email: email.toUpperCase(),
        phone,
      };
    const response = await api()
      .post("/api/front-desk/walk-in")
      .set(auth())
      .send(payload)
      .expect(201);
    expect(response.body.customer.email).toBe(email);
    expect(response.text).not.toMatch(/password|accessToken/);
    const u = await c.prisma.client.user.findUniqueOrThrow({
      where: { email },
    });
    expect(u.passwordHash).toMatch(/^\$argon2id\$/);
    expect(u.role).toBe("GUEST");
    await api()
      .post("/api/front-desk/walk-in")
      .set(auth())
      .send({ ...payload, roomId: (await room()).id })
      .expect(409);
    expect(await c.prisma.client.user.count({ where: { email } })).toBe(1);
  });
  it("filters search in SQL by reference, customer name, email, phone and room with bounded pages", async () => {
    const r = await room(),
      b = await create(r.id);
    for (const q of [
      b.reference,
      "Desk customer " + run,
      actors.guest.email,
      "09" + run.slice(0, 8),
      r.roomNumber,
    ]) {
      const res = await api()
        .get("/api/front-desk/bookings")
        .set(auth())
        .query({ q, pageSize: 1 })
        .expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBeGreaterThan(0);
    }
    const customers = await api()
      .get("/api/front-desk/customers")
      .set(auth())
      .query({ q: actors.guest.email })
      .expect(200);
    expect(customers.body.data[0].id).toBe(actors.guest.id);
    expect(customers.text).not.toMatch(/password/);
    await api()
      .get("/api/front-desk/bookings")
      .set(auth())
      .query({
        q: b.reference,
        checkIn: today,
        checkOut: tomorrow,
        view: "arrivals",
        status: "PENDING",
      })
      .expect(200)
      .expect((res) => expect(res.body.meta.total).toBe(1));
    for (const input of [
      { pageSize: 101 },
      { checkIn: "2026-02-30" },
      { q: "x".repeat(121) },
      { view: "unknown" },
    ])
      await api()
        .get("/api/front-desk/bookings")
        .set(auth())
        .query(input)
        .expect(400);
  });
  it("blocks dirty, inactive, open-task and over-capacity rooms and validates identities", async () => {
    const dirty = await room(true);
    await api()
      .post("/api/front-desk/walk-in")
      .set(auth())
      .send(body(dirty.id))
      .expect(409);
    const inactive = await room();
    await c.prisma.client.room.update({
      where: { id: inactive.id },
      data: { operationalStatus: "OUT_OF_SERVICE" },
    });
    await api()
      .post("/api/front-desk/walk-in")
      .set(auth())
      .send(body(inactive.id))
      .expect(409);
    const tasked = await room();
    await c.prisma.client.housekeepingTask.create({
      data: { roomId: tasked.id },
    });
    await api()
      .post("/api/front-desk/walk-in")
      .set(auth())
      .send(body(tasked.id))
      .expect(409);
    await api()
      .post("/api/front-desk/walk-in")
      .set(auth())
      .send({ ...body((await room()).id), guests: 4 })
      .expect(400);
    await api()
      .post("/api/front-desk/walk-in")
      .set(auth())
      .send({ ...body((await room()).id), customerId: actors.desk.id })
      .expect(404);
    await api()
      .post("/api/front-desk/walk-in")
      .set(auth())
      .send({ ...body((await room()).id), createdById: actors.admin.id })
      .expect(400);
    const available = await api()
      .get("/api/front-desk/available")
      .set(auth())
      .query({
        checkIn: today,
        checkOut: tomorrow,
        guests: 1,
        roomTypeId: typeId,
      })
      .expect(200);
    expect(
      available.body.data.some((r: { id: string }) =>
        [dirty.id, inactive.id, tasked.id].includes(r.id),
      ),
    ).toBe(false);
  });
  it("serializes simultaneous room requests and preserves overlap protection; cancellation releases the room", async () => {
    const r = await room();
    const results = await Promise.all(
      [1, 2].map(() =>
        api().post("/api/front-desk/walk-in").set(auth()).send(body(r.id)),
      ),
    );
    expect(results.map((x) => x.status).sort()).toEqual([201, 409]);
    const b = results.find((x) => x.status === 201)!.body;
    await api()
      .patch("/api/bookings/" + b.id + "/cancel")
      .set(auth())
      .send({})
      .expect(200);
    expect((await create(r.id)).status).toBe("PENDING");
  });
  it("rolls back newly created profiles when booking insert conflicts", async () => {
    const r = await room();
    await create(r.id);
    const email = "rollback-" + run + "@desk-test.invalid";
    await api()
      .post("/api/front-desk/walk-in")
      .set(auth())
      .send({
        roomId: r.id,
        checkIn: today,
        checkOut: tomorrow,
        guests: 1,
        fullName: "Rollback",
        email,
        phone: "07" + run.slice(0, 8),
      })
      .expect(409);
    expect(await c.prisma.client.user.count({ where: { email } })).toBe(0);
  });
  it("room board and dashboard use booking occupancy, not only cleanliness, and respect date filters", async () => {
    const r = await room(),
      b = await create(r.id);
    for (const action of ["confirm", "check-in"])
      await api()
        .patch("/api/bookings/" + b.id + "/" + action)
        .set(auth())
        .send({})
        .expect(200);
    const ready = await api()
      .get("/api/front-desk/rooms")
      .set(auth())
      .query({ state: "ready", roomTypeId: typeId, pageSize: 100 })
      .expect(200);
    expect(ready.body.data.some((v: { id: string }) => v.id === r.id)).toBe(
      false,
    );
    const occupied = await api()
      .get("/api/front-desk/rooms")
      .set(auth())
      .query({ state: "occupied", roomTypeId: typeId })
      .expect(200);
    expect(
      occupied.body.data.find((v: { id: string }) => v.id === r.id).bookings[0]
        .customer.id,
    ).toBe(actors.guest.id);
    const dashboard = await api()
      .get("/api/front-desk/dashboard")
      .set(auth())
      .expect(200);
    expect(dashboard.body.today).toBe(today);
    expect(dashboard.body.counts.staying).toBeGreaterThan(0);
    const occupiedHeadcount = await c.prisma.client.booking.aggregate({
      where: { status: "CHECKED_IN" },
      _sum: { guestCount: true },
      _count: true,
    });
    expect(dashboard.body.counts.staying).toBe(
      occupiedHeadcount._sum.guestCount,
    );
    expect(dashboard.body.bookingCounts.staying).toBe(occupiedHeadcount._count);
    expect(dashboard.headers["cache-control"]).toBe("no-store");
    const staying = await api()
      .get("/api/front-desk/bookings")
      .set(auth())
      .query({ q: b.reference, view: "staying" })
      .expect(200);
    expect(staying.body.meta.total).toBe(1);
    const arrivals = await api()
      .get("/api/front-desk/bookings")
      .set(auth())
      .query({ q: b.reference, view: "arrivals" })
      .expect(200);
    expect(arrivals.body.meta.total).toBe(0);
  });
  it("prevents simultaneous duplicate customer profiles by phone across different rooms", async () => {
    const rooms = await Promise.all([room(), room()]),
      phone = "06" + run.slice(0, 8);
    const results = await Promise.all(
      rooms.map((r, i) =>
        api()
          .post("/api/front-desk/walk-in")
          .set(auth())
          .send({
            roomId: r.id,
            checkIn: today,
            checkOut: tomorrow,
            guests: 1,
            fullName: "Concurrent guest",
            email: `phone-${i}-${run}@desk-test.invalid`,
            phone,
          }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(results.find((r) => r.status === 409)!.body.code).toBe(
      "WALK_IN_CUSTOMER_EXISTS",
    );
    expect(await c.prisma.client.user.count({ where: { phone } })).toBe(1);
  });
  it("creator audit is immutable and order summaries remain scoped to the requested booking", async () => {
    const b = await create((await room()).id);
    await expect(
      c.prisma.client.booking.update({
        where: { id: b.id },
        data: { createdById: actors.admin.id },
      }),
    ).rejects.toThrow();
    const stored = await c.prisma.client.booking.findUniqueOrThrow({
      where: { id: b.id },
    });
    expect(stored.createdById).toBe(actors.desk.id);
    for (const action of ["confirm", "check-in"])
      await api()
        .patch(`/api/bookings/${b.id}/${action}`)
        .set(auth())
        .send({})
        .expect(200);
    const service = await c.prisma.client.service.create({
      data: { name: "Desk service " + run, currentPrice: "100.25" },
    });
    const order = await api()
      .post("/api/service-orders")
      .set(auth("guest"))
      .send({
        bookingId: b.id,
        items: [{ serviceId: service.id, quantity: 2 }],
      })
      .expect(201);
    const list = await api()
      .get("/api/front-desk/orders")
      .set(auth())
      .query({ bookingId: b.id, status: "PENDING", pageSize: 1 })
      .expect(200);
    expect(list.body.meta.total).toBe(1);
    expect(list.body.data[0]).toMatchObject({
      id: order.body.id,
      reference: b.reference,
      roomNumber: b.roomNumber,
      customerName: b.customer.fullName,
      canProcess: true,
      totalAmount: "200.50",
    });
    await api()
      .get("/api/front-desk/orders")
      .set(auth())
      .query({ bookingId: randomUUID() })
      .expect(200)
      .expect((r) => expect(r.body.meta.total).toBe(0));
    await api()
      .get("/api/front-desk/orders")
      .set(auth())
      .query({ bookingId: "bad" })
      .expect(400);
  });
});
