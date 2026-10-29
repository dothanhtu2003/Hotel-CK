# Hotel CK — Hotel Reservation & Guest Service Management

## Dữ liệu test bổ sung — 29/10/2026

Chạy `npm.cmd run db:seed:test-data` để thêm bộ dữ liệu theo ngày tại local `hotel_dev` (cần `ALLOW_DEMO_SEED=true`). Lệnh chỉ thêm dữ liệu mang mã `TEST-YYYYMMDD`, không xóa dữ liệu cũ. Chạy lại cùng ngày sẽ giữ nguyên các thao tác test đã thực hiện, không tạo trùng hoặc đặt lại trạng thái. Chạy vào ngày khác tạo một đợt mới với phòng/tài khoản riêng.

Mỗi đợt có 32 tài khoản (đủ bốn role và một khách bị khóa), 5 loại phòng, 30 phòng, 12 dịch vụ (có dịch vụ miễn phí/tạm ngừng), 33 booking, 30 đơn dịch vụ với 60 chi tiết, 6 hóa đơn, 11 khoản thanh toán và 8 task dọn phòng. Các tình huống gồm: khách đến hôm nay, đang ở, đặt trước, hủy và đặt lại cùng lịch, booking nối tiếp, phòng bảo trì, task chưa phân công/đang dọn/hoàn tất; đơn chờ/hoàn tất/hủy; hóa đơn chưa thu/thu một phần/thu đủ; thanh toán tiền mặt/chuyển khoản/chờ/thất bại; trả phòng tự tạo task.

Tài khoản đăng nhập: `admin.YYYYMMDD@test.hotel.invalid`, `reception.YYYYMMDD@test.hotel.invalid`, `housekeeping.YYYYMMDD@test.hotel.invalid`, `guest1.YYYYMMDD@test.hotel.invalid`. Mật khẩu chung được tạo ngẫu nhiên và lưu tại `.local/test-data-password.txt`; không đưa file này lên Git. Báo cáo `.local/test-data-YYYYMMDD.json` liệt kê tài khoản, số lượng và mã booking theo từng tình huống.

Ngày được tính theo múi giờ khách sạn. Booking đã trả phòng là trả sớm trong ngày qua đúng chuỗi trạng thái và thanh toán. Để test khách dự kiến trả **hôm nay**, giữ booking đang ở qua ngày kế tiếp; không vô hiệu hóa trigger để tạo lịch sử giả. Ảnh phòng cần Cloudinary asset hợp lệ, không tạo URL giả. Dữ liệu này nằm trong PostgreSQL thật; khi test thao tác nghiệp vụ trên bảng phòng, giữ chế độ dữ liệu API (không bật nút mô phỏng mở rộng phòng).

Backend NestJS/PostgreSQL cho một khách sạn: đủ 5 core features (tìm phòng, booking nhiều đêm, Room Service, Housekeeping, Check-out Billing), JWT/RBAC, Swagger và kiểm thử PostgreSQL thật. Frontend React/Vite đã có giao diện khách hàng, lễ tân và housekeeping. Chưa triển khai cloud.

## Front Desk Operations — cập nhật 28/10/2026

Đã hoàn thiện dashboard vận hành, tìm booking/khách phía server, đặt phòng tại quầy, nhận/trả phòng, bảng phòng và xử lý dịch vụ cho RECEPTIONIST/ADMIN. Dữ liệu lấy từ API thật; giữ React/Vite, NestJS, Prisma/PostgreSQL, JWT/RBAC và các ràng buộc nghiệp vụ hiện có.

### Audit và phần tái sử dụng

- Backend theo module `auth`, `bookings`, `rooms`, `service-orders`, `billing`, `housekeeping`; frontend giữ nguyên public/guest/housekeeping layouts và các component chung.
- Tái sử dụng parse/validate ngày, booking view, room view, order view, Decimal, global validation/error filter, JWT/role guards, các endpoint chuyển trạng thái và component xác nhận/thanh toán.
- PostgreSQL tiếp tục snapshot giá, exclusion constraint chặn giao nhau, partial unique chặn hai booking CHECKED_IN/phòng, trigger kiểm điều kiện nhận phòng, khóa booking/invoice khi chốt hóa đơn/thu tiền và tự tạo task khi trả phòng.
- Hạn chế cũ đã xử lý: dashboard chỉ đếm tổng trạng thái; thiếu tên/liên hệ khách; không có tìm kiếm server/walk-in; hiển thị UUID kỹ thuật; chưa có bảng phòng kết hợp booking với housekeeping.

### Màn hình và quy trình

| Đường dẫn | Nội dung |
|---|---|
| `/reception` | Bảy KPI có liên kết, thao tác nhanh, khách sắp đến/đi, công việc ưu tiên |
| `/reception/bookings` | Tìm mã booking, tên, điện thoại, email, số phòng; lọc trạng thái/ngày/đến/đi/đang ở; phân trang server |
| `/reception/walk-in` | Chọn kỳ nghỉ/số khách → tìm phòng sạch khả dụng → liên kết khách hoặc tạo hồ sơ → xem tổng tiền → xác nhận → mở booking để xác nhận/nhận phòng |
| `/reception/bookings/:id` | Tên/liên hệ khách, phòng, kỳ nghỉ, giá chốt, điều kiện và thao tác nhận phòng |
| `/reception/bookings/:id/billing` | Kiểm chi phí, xử lý đơn dịch vụ chờ ngay tại màn hình, phát hành hóa đơn |
| `/reception/invoices/:id` | Khách/kỳ nghỉ, tiền phòng/dịch vụ, tổng/đã thu/còn thu, biên nhận, ghi nhận khoản thu và trả phòng |
| `/reception/rooms` | Bảng phòng có lọc tầng/loại/trạng thái, khách đang ở, lịch đặt trong ngày, trạng thái vệ sinh và công việc mở |
| `/reception/service-orders` | Số phòng/mã booking/tên khách, chi tiết dịch vụ, lọc trạng thái, hoàn thành/hủy nhanh; có thể lọc riêng một booking |

ADMIN sử dụng cùng các màn hình dưới `/admin` và được phép vào `/reception` theo guard hiện có. Không mở quyền cho GUEST/HOUSEKEEPING. Website khách và các màn hình housekeeping giữ nguyên quy trình.

**Ngày và đơn vị thống kê:** Asia/Ho_Chi_Minh; ngày lưu trú là `[checkIn, checkOut)`. Khách dự kiến đến là PENDING/CONFIRMED nhận hôm nay; dự kiến đi là CHECKED_IN trả hôm nay; đang lưu trú xét trạng thái CHECKED_IN kể cả khách quá ngày trả chưa được checkout. Ba KPI khách cộng `guestCount`, đồng thời ghi số booking bên dưới để phân biệt số người với số kỳ nghỉ. Phòng trống sạch phải ACTIVE/CLEAN, không có task mở, không có khách còn CHECKED_IN và không bị booking hiệu lực chiếm lịch hôm nay. CHECKED_OUT vẫn giữ nguyên khoảng lịch sử theo quy tắc hiện tại; CANCELLED không chiếm lịch. Phòng cần dọn bao gồm DIRTY/CLEANING.

### API mới

Tất cả dưới `/api/front-desk`, cần JWT với role RECEPTIONIST/ADMIN; trả `Cache-Control: no-store`.

| Method/path | Mục đích |
|---|---|
| `GET /dashboard` | Snapshot KPI và hai danh sách tối đa 5 booking, transaction REPEATABLE READ |
| `GET /bookings` | `q`, `status`, `checkIn`, `checkOut`, `view=arrivals/departures/staying`, `page`, `pageSize` (tối đa 100) |
| `GET /bookings/:id` | Chi tiết khách/phòng/task cần cho lễ tân; không trả password/token |
| `GET /customers` | `q` tối thiểu 2 ký tự, `page`; 10 hồ sơ GUEST ACTIVE/trang |
| `GET /available` | Kế thừa availability service, bổ sung CLEAN, không task mở và không có khách còn CHECKED_IN |
| `POST /walk-in` | `roomId`, `checkIn`, `checkOut`, `guests` và **một trong** `customerId` hoặc `fullName/email/phone` |
| `GET /rooms` | `floor`, `roomTypeId`, `state=ready/dirty/occupied`, `page`, `pageSize` |
| `GET /room-filters` | Danh sách loại phòng/tầng từ DB, độc lập phân trang bảng phòng |
| `GET /orders` | `status`, `bookingId`, `page`, `pageSize`; trả nhãn booking/phòng/khách và khả năng xử lý |

Các mutation confirm/check-in/cancel, order complete/cancel, billing-preview, invoice, payments, check-out tiếp tục dùng API hiện có. Guest APIs không được thêm dữ liệu khách khác.

**Walk-in:** transaction khóa phòng, kiểm ACTIVE/CLEAN/task/sức chứa/khách hiện tại, liên kết GUEST ACTIVE; DB kiểm lại giá và overlap. Hồ sơ mới và booking commit/rollback cùng nhau. Email chuẩn hóa chữ thường; hồ sơ trùng email/điện thoại yêu cầu tìm/chọn khách hiện có, không âm thầm gán chủ booking. Advisory lock theo điện thoại bảo vệ hai yêu cầu tạo hồ sơ tại quầy đồng thời; UNIQUE email vẫn là lớp bảo vệ cuối. Mật khẩu ngẫu nhiên đủ mạnh được băm Argon2, không trả hoặc ghi log mật khẩu, không tạo JWT/phiên đăng nhập khách. Booking mới có mã `CK-…`, bắt đầu PENDING rồi theo đúng CONFIRMED → CHECKED_IN.

**Migration mới:** `prisma/migrations/202610280001_front_desk/migration.sql` chỉ thêm `bookings.created_by_id` nullable, FK tới users, index và trigger bảo vệ người tạo là staff ACTIVE, không cho sửa người tạo. Booking cũ giữ NULL, không sửa giá/ngày/chủ/trạng thái. Đã áp dụng trên local `hotel_dev` và `hotel_test`; không seed/reset lại dữ liệu.

**Thanh toán và mạng:** giữ nguyên Idempotency-Key và cơ chế lưu/đối chiếu khoản thu khi mất phản hồi. Không phát hành invoice khi còn PENDING, không checkout khi thiếu tiền. Khi kết quả tạo walk-in không rõ do mạng/5xx, UI chặn gửi lại trong luồng hiện tại và dẫn tới danh sách để kiểm tra. Không tự retry mutation. Lỗi hồ sơ đã có, phòng chưa sẵn sàng/đang có khách có mã lỗi riêng, frontend chỉ nhận các mã cho phép, không hiển thị thông báo DB tùy ý.

### Chạy và kiểm tra local

Yêu cầu Node/npm theo `package.json`, PostgreSQL local, `.env` đã cấu hình; không đưa secret vào `VITE_*`. Với checkout mới, chạy `npm.cmd ci` tại gốc và `npm.cmd --prefix frontend ci` trước.

```powershell
cd 'E:\Hotel CK'
npm.cmd run db:local:start
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run start:dev
# Terminal khác:
cd 'E:\Hotel CK\frontend'
npm.cmd run dev
```

Mở [giao diện lễ tân](http://localhost:5173/reception), đăng nhập bằng tài khoản RECEPTIONIST/ADMIN hiện có. API local ở `http://127.0.0.1:3000/api`; Swagger ở `/api/docs`. Không tạo mật khẩu staff mặc định. Nếu môi trường mới chưa có dữ liệu, làm theo phần Database bên dưới; không chạy seed trên dữ liệu vận hành đang có.

Kiểm thử backend/API và E2E chỉ ghi fixtures vào database local `hotel_test` đã được kiểm tra tên/host. Chạy các suite DB tuần tự; cần áp dụng migration trên `TEST_DATABASE_URL` trước khi chạy backend/E2E (`DIRECT_URL` phải trỏ cùng DB test khi dùng Prisma CLI).

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run test:backend
npm.cmd run test:database
npm.cmd --prefix frontend run typecheck
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run build
npm.cmd --prefix frontend run test:e2e
```

Các test bao phủ: online check-in; walk-in với khách mới và khách đã có; tạo hồ sơ/đặt phòng đồng thời; phòng DIRTY/OUT_OF_SERVICE/task mở/sai sức chứa; booking trùng và hủy; dịch vụ PENDING/COMPLETED/CANCELLED; invoice/thu nhiều lần/check-out/task; role/ownership/401/403/404; gửi trùng/mất phản hồi thanh toán; loading/empty/offline/XSS và viewport 320/390/768/1440px. Test cũ chỉ cập nhật các kỳ vọng giao diện đã thay đổi (7 KPI, nhãn ngắn, nhận diện booking qua data attribute); không xóa test hoặc nới các kiểm tra nghiệp vụ.

### Kết quả xác minh bản cuối

| Kiểm tra | Kết quả |
|---|---|
| Backend typecheck / lint / build | PASS |
| Frontend typecheck / lint / build | PASS |
| Backend unit + API integration | 272/272 PASS, 19 suites |
| PostgreSQL integrity | 38/38 PASS |
| Frontend unit | 89/89 PASS, 9 files |
| Browser E2E toàn hệ thống | 64/64 PASS, backend/PostgreSQL thật |
| Visual QA | Đã xem ảnh desktop 1440px và mobile 320px; kiểm overflow ở 320/390/768/1440px |

Không còn lỗi trong các kiểm tra đã chạy. Ảnh kiểm thử local ở `.local/front-desk-dashboard.png` và `.local/front-desk-board-mobile.png` (dữ liệu fixtures chỉ nằm trong `hotel_test`, không đưa vào trang vận hành). Hai test browser đầu xác minh walk-in khách mới/khách có sẵn; một test bổ sung xác minh thông báo trùng hồ sơ, sửa lựa chọn khách và từ chối check-in phòng DIRTY. Các warning Node VM Modules/NO_COLOR là thông báo của test runner; các truy cập env bị Vite từ chối là kiểm thử bảo vệ file riêng tư.

**Giới hạn theo kiến trúc hiện có:** hồ sơ walk-in mới cần email thật do schema User bắt buộc email duy nhất. Chưa có luồng xác minh email/cấp lại mật khẩu cho hồ sơ do lễ tân tạo; không tự đặt mật khẩu mặc định. BANK_TRANSFER là ghi nhận khoản thu staff đã xác minh, chưa có kết nối ngân hàng. Không có deploy production, push hoặc merge trong đợt này.

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
