# Hotel CK — Hotel Reservation & Guest Service Management

Backend NestJS/PostgreSQL cho một khách sạn: đủ 5 core features (tìm phòng, booking nhiều đêm, Room Service, Housekeeping, Check-out Billing), JWT/RBAC, Swagger và kiểm thử PostgreSQL thật. Chưa xây dựng frontend hoặc triển khai cloud.

## Phase 7 — Guest Check-out & Billing

Frontend Phase 8A đã có trong [frontend/](frontend/README.md), dùng package/config riêng: trang chủ, auth, hồ sơ và layout theo bốn role. Chạy `npm.cmd run dev` trong frontend để mở http://localhost:5173, kết nối backend local port 3000. UI nghiệp vụ mới chỉ là trang chưa sẵn sàng; chi tiết kiến trúc, kiểm thử và giới hạn ở README frontend.

Xem [API, payment idempotency, migration bắt buộc và báo cáo kiểm thử](docs/backend/billing.md). Invoice lấy snapshot do PostgreSQL tính; chỉ tính dịch vụ COMPLETED và chặn đơn PENDING. Staff ghi nhận CASH/BANK_TRANSFER đã xác minh, hỗ trợ thanh toán nhiều lần với số dư chính xác. Checkout cần PAID; DB tự chuyển phòng DIRTY và tạo/reuse một task TODO.

Giữ nguyên Prisma schema, dependencies và ba migration cũ. Bổ sung `202610270004_staged_billing`: contract cũ buộc invoice/checkout commit cùng transaction, không hỗ trợ chuỗi HTTP invoice → payment → checkout. Migration mới chỉ đổi/bổ sung trigger functions, không thay bảng/cột/enum hay dữ liệu nghiệp vụ. Đã áp dụng trên local hotel_test rồi hotel_dev; không cần chạy seed lại.

## Phase 6 — Housekeeping Status Updates

Xem [API, phân quyền, trigger và báo cáo Phase 6](docs/backend/housekeeping.md). Receptionist/admin xem board, tạo/phân công task TODO; HOUSEKEEPING chỉ xem và thao tác công việc được giao. DB tự đồng bộ TODO→DIRTY, IN_PROGRESS→CLEANING, DONE→CLEAN và timestamp hoàn thành. Có phân trang, bộ lọc, conditional update và kiểm thử cạnh tranh; không có staff override cho start/complete hoặc API sửa trực tiếp trạng thái phòng.

## Phase 5 — Room Service Ordering

Xem [API, trigger và kết quả kiểm thử Phase 5](docs/backend/room-service.md). Danh mục dịch vụ public chỉ hiển thị dịch vụ active. GUEST đặt một/nhiều dịch vụ cho booking CHECKED_IN của mình; DB snapshot giá và tính tổng. Nhân viên hoàn tất đơn, chủ đơn/nhân viên hủy đơn PENDING; COMPLETED/CANCELLED là trạng thái cuối. Tạo đơn/items cùng transaction, khóa booking và conditional update để chống race condition.

## Phase 4 — Room Availability & Multi-night Booking

Xem [API, chính sách và kết quả kiểm thử Phase 4](docs/backend/room-booking.md). GET /api/rooms, /api/rooms/:id và /api/rooms/available là public; booking dùng JWT/RBAC, ownership và snapshot do PostgreSQL tính. Exclusion constraint chống overbooking vẫn là lớp bảo vệ cuối cùng; xung đột trả HTTP 409. Không có endpoint check-out ở phase này.

## Phase 3 — Authentication & User Profile

Xem [báo cáo và hướng dẫn authentication](docs/backend/authentication.md). Có POST /api/auth/register, POST /api/auth/login, GET /api/auth/me, GET/PATCH /api/users/me. Tài khoản mới luôn GUEST; profile chỉ cho sửa fullName/phone. JWT mặc định 15 phút, role/trạng thái được đọc lại từ DB ở mỗi request. Không có logout server hoặc refresh token ở phase này.

## Backend foundation

NestJS được tích hợp ngay tại gốc dự án để dùng chung Prisma Client/adapter 7.10.1, DATABASE_URL và schema hotel hiện có. Xem [cấu trúc, cấu hình và báo cáo xác minh backend](docs/backend/backend-foundation.md).

Nếu database local và `.env` đã được cấu hình từ giai đoạn trước:

```powershell
npm.cmd ci
npm.cmd run db:generate
npm.cmd run auth:setup
npm.cmd start
```

Health: [http://127.0.0.1:3000/api/health](http://127.0.0.1:3000/api/health). Swagger: [http://127.0.0.1:3000/api/docs/](http://127.0.0.1:3000/api/docs/). Chế độ phát triển: `npm.cmd run start:dev`.

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:backend
```

Backend startup và tests backend không chạy migration/seed. Khi chuẩn bị hotel_test cần đủ 4 migrations; `test:database` bên dưới tự migrate deploy đúng local TEST_DATABASE_URL. Chạy hai bộ test tuần tự vì dùng chung hotel_test; không chạy song song.

## Database

Đọc [hướng dẫn cài đặt](docs/database/database-setup.md), [ERD](docs/database/ERD.md), [từ điển dữ liệu](docs/database/data-dictionary.md), [quy tắc nghiệp vụ](docs/database/business-rules.md), [test cases](docs/database/test-cases.md) và [báo cáo thực thi](docs/database/implementation-report.md).

```powershell
npm.cmd ci
npm.cmd run db:local:start
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run test:database
npm.cmd run db:verify
```

Local cluster riêng: 127.0.0.1:55432, database hotel_dev/hotel_test. Secret local tự sinh, bị loại khỏi Git. Chưa kết nối Supabase; cần URL/project được cấu hình và cho phép trước khi triển khai cloud.
