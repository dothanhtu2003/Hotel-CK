# Kế hoạch QA audit Hotel-CK

Ngày thực hiện: 10/11/2026, múi giờ Asia/Bangkok (cùng UTC+7 với khách sạn). Đối tượng: trạng thái working tree hiện tại, gồm các thay đổi có sẵn trước audit; không chỉ HEAD/README.

## Mục tiêu và quy tắc đánh giá

Kiểm tra hành trình khách mới, khách đang ở, lễ tân, buồng phòng và admin qua React/Vite → NestJS HTTP → PostgreSQL thật. Không sửa mã nguồn, UI, migration hoặc test hiện có. Mọi script mới chỉ nằm trong thư mục audit. Không gọi website demo, database cloud, ngân hàng hay API payOS thật.

- **PASS**: đã chạy và kiểm tra assertion/kết quả cụ thể; không suy ra cả chức năng từ một trang render thành công.
- **FAIL**: ca đã chạy nhưng kết quả khác mong đợi; phân biệt lỗi sản phẩm, test lỗi thời và lỗi fixture/harness.
- **BLOCKED**: có trở ngại cấu hình/dịch vụ khiến chưa thể chạy bước yêu cầu.
- **NOT TESTED**: chưa thực hiện; không cộng vào PASS.

Không cộng các lần replay vào số ca độc lập. Không quy 47 lỗi backend hoặc 44 lỗi Playwright có sẵn thành cùng số bug sản phẩm. Test lỗi trước bước nghiệp vụ không chứng minh nghiệp vụ phía sau đã được kiểm thử.

## Phân tích trước và trong khi kiểm thử

Đối chiếu README, package scripts, controller/service/DTO/guard, React router/pages/auth/API client, Prisma schema, SQL migrations, test factories và test hiện có. Danh mục chi tiết ở COVERAGE_MATRIX.md và OpenAPI thực lấy từ backend ở evidence/openapi.json.

Schema hiện có **15 model**, không phải 12 bảng nghiệp vụ như sơ đồ README: User, RoomType, Room, RoomImage, Booking, Service, ServiceOrder, ServiceOrderItem, HousekeepingTask, RoomStatusChange, Invoice, Payment, BookingPayment, StaySegment, StayExtension. SQL bổ sung exclusion constraint, trigger bảo vệ số tiền/chuyển trạng thái, hold limit và lịch sử lưu trú.

Các khác biệt đáng chú ý: có hold 15 phút và đối soát; có gia hạn/chuyển phòng và lịch sử segment; token được lưu localStorage; checkout đã bỏ khỏi exclusion constraint nhưng availability vẫn lọc CHECKED_OUT. Phần tiện nghi/ảnh minh họa frontend không tương đương dữ liệu amenities CRUD trong database.

## Môi trường và cách cô lập

| Thành phần | Cấu hình thực chạy |
|---|---|
| OS / Node | Windows / Node 24.15.0 |
| PostgreSQL | 18.3, PostgreSQL binaries cài sẵn |
| Cluster regression | 127.0.0.1:55439, database hotel_test, schema hotel |
| Cluster exploratory | 127.0.0.1:55440, database hotel_test, schema hotel |
| Regression API / frontend | 127.0.0.1:3301 / localhost:5174, server do Playwright quản lý |
| Exploratory API / frontend | 127.0.0.1:3309 / localhost:5179 |
| Browser | Google Chrome qua Playwright, headless |
| Viewport | desktop 1440×1000; mobile 390×844/900 và 320×900; regression có thêm tablet |
| Thanh toán | adapter mock payOS tại server QA; frontend route chặn và fulfill trang provider bằng HTML mock |

`scripts/environment.ps1` tạo cluster riêng dưới `.local/qa-audit`, thiết lập DATABASE_URL/DIRECT_URL/TEST_DATABASE_URL cho tiến trình con và xóa cấu hình khóa payOS trong môi trường tiến trình. Không sửa `.env`. Test factory còn kiểm tra localhost, tên hotel_test và current_database(). Migrations deploy lên hai cluster QA, không migrate database mặc định của dự án.

Mock trả currency/order/amount/status, hỗ trợ hủy, thiếu tiền, lỗi gateway và webhook lặp. URL có hostname payOS để vượt validation hợp lệ của ứng dụng, nhưng Playwright intercept trước network. QR và tài khoản là dữ liệu giả, không thể dùng làm bằng chứng thanh toán thật. Chữ ký `QA-MOCK-SIGNATURE` chỉ kiểm tra logic adapter; **không xác nhận mật mã SDK/provider**.

Tài khoản giả: GUEST ×2, RECEPTIONIST, HOUSEKEEPING ×2, ADMIN; thêm tài khoản đăng ký bằng UI và fixtures của regression. Email dùng `.invalid`, mật khẩu sinh ngẫu nhiên. Credentials chỉ nằm trong `.local/qa-audit/fixtures.json`, không đưa vào báo cáo. Giá phòng exploratory 650.000đ, sức chứa 2, dịch vụ 45.000đ; mock booking 3 đêm = 1.950.000đ. Fixture lịch sử dùng INSERT trực tiếp có chủ đích, khác với ca kiểm tra endpoint tạo booking. Riêng fixture quá hạn: tạo CHECKED_IN hợp lệ rồi tạm tắt **guard_bookings trong transaction của cluster 55440** để đưa checkout về quá khứ, bật lại trước COMMIT. Đây là mô phỏng thời gian, không phải thao tác sản phẩm.

Regression dùng chung cluster 55439 nên giữ phòng theo IP và phân trang dữ liệu cộng dồn có thể gây nhiễu. Lần exploratory đầu dùng nhầm dữ liệu cùng cluster regression được giữ ở `exploratory-initial-contaminated.json` và **loại khỏi kết luận/tổng số ca**. Sau đó chuyển cả API và truy vấn kiểm chứng sang 55440; kết quả cuối ở exploratory-api.json. Lỗi selector/mock/SQL trong harness đã được phân tích và replay, không ghi thành bug sản phẩm.

## Trình tự nghiệp vụ và oracle

1. Khách mới: tìm 3 đêm → mở phòng → đăng ký → đăng nhập quay lại phòng → kiểm tra báo giá → đặt và chuyển trang payOS mock. API/database phải giữ PENDING cho tới đủ tiền; ownership trả 404.
2. Thanh toán: hai lần tạo link, trả thiếu, trả đủ, webhook lặp/không có chữ ký, hủy provider, gateway lỗi. Kiểm tra số dòng payment, status booking và số tiền database; không chỉ thông báo UI.
3. Khách đang ở: dịch vụ 2×45.000 → đơn 90.000, request checkout; lễ tân nhìn thấy request. Đơn pending chặn invoice/checkout. Invoice trừ tiền phòng đã trả đúng một lần.
4. Lễ tân: thu 45.000 hai lần cùng key phải chỉ ghi một khoản; hai khoản cuối đồng thời chỉ một được nhận. Còn nợ không checkout; đủ tiền checkout → DIRTY + một TODO. Chạy riêng chuỗi UI walk-in tiền mặt → CHECKED_IN → invoice PAID → CHECKED_OUT.
5. Buồng phòng: lễ tân assign → chỉ người được giao start → CLEANING → complete → CLEAN; hai yêu cầu start chỉ một thành công. Nhân viên không tự nhận task chưa được phân công qua API hiện tại.
6. Gia hạn/quá hạn: so sánh giá thực; có booking kế tiếp phải chọn phòng khác, giữ nguyên booking kế tiếp và làm bẩn phòng cũ. Public search và front desk phải phù hợp tình trạng phòng thật. Quá hạn không được walk-in vào phòng đang có khách.
7. Phân quyền/bảo mật: anonymous 401; guest bị chặn staff routes; đọc/cancel booking/order người khác 404; mass assignment role/status/price 400; admin truy cập các nghiệp vụ đã có; JWT hết hạn/sai chữ ký và disabled account qua regression/backend.
8. UI: navigation desktop/mobile, lỗi JavaScript, overflow, form ngày, offline và retry, API 401, reload và persistence session. Screenshot/trace được lưu; test UI-09 chỉ chứng minh URL ngày sai không tự POST, validation chủ động được xác minh đầy đủ ở API DATE-01..07.

## Lệnh chính đã chạy

```powershell
. ./docs/qa-audit/scripts/environment.ps1
npm run test:database
npm run test:backend -- --json --outputFile=docs/qa-audit/evidence/backend-tests.json
# Trong frontend, cùng môi trường QA:
npm test -- --reporter=json --outputFile=../docs/qa-audit/evidence/frontend-unit.json
npx playwright test --config=../docs/qa-audit/scripts/baseline.config.mjs

# Exploratory: môi trường 55440 trong từng terminal khởi động backend/test
. ./docs/qa-audit/scripts/environment.ps1 -QaPort 55440
npx prisma migrate deploy
node docs/qa-audit/scripts/audit-server.mjs
# Terminal frontend: VITE_API_BASE_URL=http://127.0.0.1:3309/api; vite --port 5179
# Terminal test, sau khi server đã ghi fixtures mới:
node docs/qa-audit/scripts/exploratory-api.mjs
node docs/qa-audit/scripts/supplemental-api.mjs
npx --prefix frontend playwright test --config=docs/qa-audit/scripts/exploratory.config.mjs
npx --prefix frontend playwright test --config=docs/qa-audit/scripts/replay.config.mjs --grep 'UI-03|UI-07|UI-10'
```

Các script tạo dữ liệu cộng dồn; chạy lại toàn bộ trên database cũ có thể gặp limit/booking trùng. Không tự reset database hiện có. Chỉ tái tạo trên cluster QA đã xác định hoặc dùng fixture mới. Native Playwright bổ sung cho lễ tân có trace độc lập, ghi trong reception-manual-playwright.json.

## Giới hạn và điều kiện sẵn sàng demo

payOS sandbox/provider thật và xác minh chữ ký thật: BLOCKED vì không có kênh sandbox/credentials được xác thực; không dùng khóa thật để vượt trở ngại. Worker chạy lịch trong daemon production-mode, tải lớn, thiết bị mobile thật và trình duyệt ngoài Chrome: NOT TESTED. Không kiểm toán pentest toàn diện, backup/restore hay hạ tầng triển khai thật.

Gate demo: xử lý các High, thống nhất availability và bảng phòng, không còn sai tiền, grants dùng được với runtime không sở hữu schema, mobile chính không tràn; rerun regression sau khi cập nhật fixture/selector theo nghiệp vụ đã duyệt. Hiện tại chưa đạt gate demo toàn diện; có thể trình diễn luồng đã xác minh trong môi trường mock nếu công bố rõ giới hạn.
