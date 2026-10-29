# Kamra front-desk migration — implementation and API map

Reference: https://github.com/Kamra-PMS/kamra-pms at 15aa82ac743ff3c254f9608e8418c5b5dfee68d2, inspected 2026-10-29. Isolated reference checkout: E:/kamra-pms-reference. Demo landing page was accessible at https://demo.kamrapms.com. Visual references are the repository's published PNGs, not invented mockups.

## Component mapping

| Kamra reference | Hotel-CK implementation | Adaptation |
|---|---|---|
| App.tsx / AppShell.tsx | app.tsx / layouts/workspace-layout.tsx / features/workspace/navigation.ts | White 224px sidebar, compact topbar, visible desk navigation; existing JWT/role guards |
| screens/Today.tsx | features/reception/today.tsx | Six factual metrics, arrivals/departures, floor board and in-house list |
| screens/InHouse.tsx | pages/front-desk-pages.tsx ReceptionBookingsPage | Arrivals/in-house/departures tabs, date navigation, search, status and server pagination |
| components/CheckInDialog.tsx / StepFlow | features/reception/check-in.tsx | Three supported steps: guest/stay, assigned room readiness, final review; no identity-document requirement |
| components/BookingDialog.tsx | ReceptionWalkIn | Existing account search and legitimate new customer email, real availability quote, reservation creation |
| screens/ReservationDetail.tsx | reception-booking-pages.tsx / reservation-panels.tsx | Detailed route with charges, service orders, payment tabs and existing permitted actions |
| screens/Rooms.tsx / components/RoomDrawer.tsx | ReceptionRoomBoard and Today room sheet | Separate occupancy and housekeeping display; authorized housekeeping links |
| screens/TapeChart.tsx / CalendarView.tsx | features/reception/tape-chart.tsx | 14-day read-only physical-room chart, clipped multi-night bars, room type filter and server pagination |
| components/CheckOutDialog.tsx | reception-billing-pages.tsx / CheckoutSummary / PaymentForm | Existing invoice-first policy retained, recorded payments, balance and final confirmation |
| index.css / UI cards, badges, buttons, sheets | features/reception/kamra.css with existing UI primitives | Warm neutrals, green accents, system typography, compact density and responsive sheets |
| RoomChangeDialog.tsx | No writer imported | Hotel-CK does not support validated room reassignment; assigned room is reviewed rather than changed |

Kamra code, assets and components were inspected as reference; none were copied into the application. The implementation uses Hotel-CK's existing React components and API client. Kamra is AGPL-3.0; its license.txt remains in the isolated reference. No Kamra Frappe API, auth, POS, accounting or database modules were imported. No new package dependency was needed.

## API mapping

All paths below are relative to `/api`. All desk requests use the existing bearer JWT. R = RECEPTIONIST or ADMIN; G = owning guest; H = assigned housekeeping staff. All GETs take no request body. Invalid input = 400, missing auth = 401, wrong role = 403, missing record = 404; transition/race conflicts = 409. The existing API client and UI display these failures. Mutations never automatically retry.

| Screen/action | Method / endpoint | Query or body | Typed response | Role / refresh |
|---|---|---|---|---|
| Today metrics and lists | GET /front-desk/dashboard | none | Dashboard | R; 30s polling, manual refresh |
| Operational lists | GET /front-desk/bookings | view, date, status, q, checkIn, checkOut, page, pageSize | Page<DeskBooking> | R; query-key filters, 30s polling |
| Reservation/check-in context | GET /front-desk/bookings/:id | UUID path | DeskBooking with room/customer/openTaskCount | R; refresh on wizard open |
| Rooms / tape | GET /front-desk/rooms | floor, roomTypeId, state, page, pageSize; tape start/end | Page<DeskRoom> | R; date/filter key changes and polling |
| Room facets | GET /front-desk/room-filters | none | types[], floors[] | R |
| Availability and quote | GET /front-desk/available | checkIn, checkOut, guests, optional roomTypeId | Availability | R; validated by RoomsService |
| Existing guest search | GET /front-desk/customers | q (2–120 chars), page | Page<Customer> | R |
| Walk-in | POST /front-desk/walk-in | roomId, checkIn, checkOut, guests; customerId OR fullName/email/phone | DeskBooking | R; refresh reception, guest and housekeeping caches; detail navigation |
| Confirm / cancel / check in | PATCH /bookings/:id/{confirm,cancel,check-in} | empty | Booking | R (cancel also G); same cache invalidation |
| Stay services | GET /front-desk/orders | bookingId, status, page, pageSize | Page<Order> with desk metadata | R |
| Service detail | GET /service-orders/:id | none | Order | R or G |
| Complete / cancel service | PATCH /service-orders/:id/{complete,cancel} | empty | Order | R; cancel also G under ownership policy; refresh caches |
| Billing preview | GET /bookings/:id/billing-preview | none | Preview (roomAmount, serviceAmount, totalAmount, pendingOrderCount, completedOrders) | R/G; authoritative server consolidation |
| Find / issue invoice | GET or POST /bookings/:id/invoice | empty | Invoice; GET 404 means not issued | R/G GET; R POST; refresh caches |
| Invoice / receipts | GET /invoices/:id | none | Invoice incl. payments, paidAmount, balance | R/G |
| Record receipt | POST /invoices/:id/payments | amount decimal string, method CASH/BANK_TRANSFER; Idempotency-Key UUID header | PaymentResult | R; verified receipt form, retained retry key, cache invalidation |
| Check out | PATCH /bookings/:id/check-out | empty | Checkout | R; requires PAID, zero balance, no pending services; marks room dirty and creates/reuses task atomically |
| Housekeeping board/tasks | GET /housekeeping/{board,tasks,tasks/:id} | existing filters | BoardRoom/Task pages | R/H; existing role-scoped UI |
| Create/assign task | POST /housekeeping/tasks; PATCH /housekeeping/tasks/:id/assign | roomId/notes; assignedStaffId | Task | R; existing query invalidation |
| Start/complete cleaning | PATCH /housekeeping/tasks/:id/{start,complete} | empty | Task | H only; receptionist does not receive these controls |

## Additive API changes

No new endpoint paths. No schema/database migrations or environment changes.

- Dashboard adds `totalRooms`, `occupiedRooms`, `openTasks`, read in the same repeatable-read transaction as existing counts. Occupied means a physical room with a CHECKED_IN booking. Occupancy denominator is all physical rooms, explicitly labeled in UI. No invented revenue or trend lines.
- Booking list accepts an optional validated `date` (hotel date). Arrivals/departures remain disjoint by status; in-house remains CHECKED_IN and, when date is selected, overlaps that day. This is current operational state, not historical state reconstruction.
- Room list accepts optional validated `start` and `end`, both required together, 1–31 nights. Embedded bookings use `checkInDate < end AND checkOutDate > start`, excluding cancelled stays. With no range the existing current-room query is preserved. Page limits and role guards remain unchanged.
- Tape uses hotel-local today and UTC arithmetic on date-only values, avoiding browser timezone shifts. Checkout dates never occupy a night. No empty-cell booking, dragging or reassignment.

## Integrity decisions

Removed operational demo-room injection. Room readiness requires active, clean, no current allocation, and no open cleaning task. Occupied rooms can still show dirty/cleaning independently. Every check-in is ultimately validated by existing backend/database rules. Customer email is now explicitly required and placeholder generation has been removed. Duplicate customers still produce the existing conflict and identity-linking path.

Guest booking and service ordering endpoints, JWT implementation, Prisma schema, transactions, exclusion/overlap protections, invoice/payment consistency and assigned-housekeeper permissions are retained. Existing test factories guard both connection URL and current_database() before creating additive local hotel_test fixtures.

## Deployment readiness

1. Review the working diff; pre-existing edits to frontend/src/pages/room-pages.tsx and frontend/src/styles.css belong to the user and were preserved.
2. Run backend typecheck/lint/build/tests and frontend typecheck/lint/build/unit/Playwright tests as recorded in the verification report.
3. Deploy the additive Nest backend changes to Render first using the existing build/start commands and configuration. No migration or data reset is needed for this change.
4. Deploy frontend/dist through the existing Vercel frontend project. Keep the existing API URL, CORS, JWT, Supabase and Cloudinary configuration.
5. Smoke-test with authorized staging accounts: login, availability, legitimate customer booking, check-in, service completion, invoice, payment and checkout; check assigned-housekeeper workflow and mobile navigation.
6. Rollback frontend and backend artifacts together if needed. No production deployment was performed by this task.

Remaining deviations from Kamra: local-language text and existing Hotel-CK branding; supported fields only; reservation detail remains a route; checkout follows Hotel-CK's invoice-before-checkout policy. No identity scan, key issuance, deposits, room moves, layout customization, revenue reporting or fake occupancy sparkline. Room floor counts are labeled as current-page counts; dashboard metrics are hotel-wide.
