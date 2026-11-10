# Bug report — Hotel-CK, 10/11/2026

Không sửa lỗi trong audit. Severity phản ánh ảnh hưởng đã quan sát trong môi trường QA; không suy ra trạng thái production. Các đường dẫn code là working tree hiện tại.

## QA-001 — High — Gia hạn/quá hạn dùng giá cố định 1.000đ

- Vai trò: lễ tân, admin, khách bị tính tiền sai.
- Chức năng: `POST /api/bookings/:id/extension-preview`, `PATCH /api/bookings/:id/extend`.
- Bước tái hiện: tạo phòng giá 650.000đ/đêm và booking CHECKED_IN hai đêm; gọi preview với expectedCheckOut là ngày checkout hiện tại, checkOut cộng một ngày; kiểm tra additionalAmount. Sau đó xác nhận quote và kiểm tra total_room_amount.
- Mong đợi: thêm một đêm tính theo mức giá nghiệp vụ được duyệt, mặc định cùng phòng 650.000đ; nếu có giá ưu đãi cần cấu hình/quy tắc rõ ràng.
- Thực tế: extensionAmount `1000.00`, nightlyPrice `1000.00`, total từ `1300000.00` thành `1301000.00`; mã dùng cùng mức cố định cho overdue và phòng thay thế. Không thấy cấu hình bật/tắt giá test theo NODE_ENV.
- Bằng chứng: `evidence/exploratory-api.json`, ca EXT-01 FAIL, EXT-02 xác nhận chuyển phòng thành công; regression stay-extension pass vì chính test mong giá 1.000đ, không chứng minh giá sản phẩm đúng.
- Code: `src/bookings/stay-extension.ts:8`, `:33`, `:34`, `:45`, `:48`.
- Ưu tiên: P1, cần BA xác nhận chính sách giá và tách dữ liệu demo khỏi logic áp dụng thật.

## QA-002 — High — Grants runtime thiếu bảng lịch sử, nhận/trả phòng lỗi

- Vai trò: lễ tân/admin qua backend sử dụng tài khoản database hạn chế quyền.
- Chức năng: check-in/check-out và lịch sử/gia hạn trên runtime không phải owner.
- Bước tái hiện: trên cluster QA tạo role NOLOGIN trong transaction; áp dụng nguyên template `scripts/release-runtime-grants.sql` thay tên role; owner tạo booking CONFIRMED hợp lệ hôm nay; SET LOCAL ROLE sang runtime; UPDATE booking CHECKED_IN. ROLLBACK toàn bộ fixture/role sau kiểm tra.
- Mong đợi: runtime có quyền tối thiểu cần cho workflow, không cần owner/superuser.
- Thực tế: SQLSTATE `42501`, `permission denied for table stay_segments`. Test database 37 cũng thất bại khi CHECKED_OUT vì trigger cập nhật bảng này.
- Bằng chứng: `evidence/supplemental-DB-ROLE-01.json`, `evidence/restricted-runtime.log`, `evidence/database-tests.log`.
- Code: `scripts/release-runtime-grants.sql:5` (danh sách grants không có stay_segments/stay_extensions); `prisma/migrations/202611040004_stay_segments_and_transfer/migration.sql:59` (record_actual_stay và trigger).
- Phạm vi: API exploratory chạy bằng owner để kiểm tra nghiệp vụ; không báo lỗi này đã xuất hiện trên deployment thật. Lỗi template và restricted workflow đã tái hiện trực tiếp.
- Ưu tiên: P1 trước demo bằng runtime role đúng thiết kế.

## QA-003 — High — Public search bán phòng đang có khách quá hạn

- Vai trò: khách đặt mới và lễ tân.
- Chức năng: `GET /api/rooms/available`, đặt booking hôm nay.
- Bước tái hiện: mô phỏng booking CHECKED_IN có checkout hôm qua trên một phòng ACTIVE/CLEAN; gọi availability cho hôm nay → ngày mai; đối chiếu bảng phòng và thử walk-in cùng phòng.
- Mong đợi: phòng đang có người ở quá hạn không được quảng bá là sẵn sàng nhận khách hôm nay; phải thống nhất với front desk.
- Thực tế: phòng có trong public availability; walk-in trả 409 `WALK_IN_ROOM_OCCUPIED`. Public filter chỉ xét khoảng ngày dự kiến, không xét toàn bộ CHECKED_IN quá hạn như nhánh frontDesk.
- Bằng chứng: `evidence/exploratory-api.json` OVER-01 PASS và OVER-02 FAIL. Fixture quá hạn được tổng hợp riêng, cách tạo ghi trong TEST_PLAN.
- Code: `src/rooms/rooms.service.ts:29` và `:37` — chặn mọi CHECKED_IN chỉ bật khi frontDesk && isToday.
- Ưu tiên: P1, có thể nhận tiền khách mới cho phòng chưa thể nhận.

## QA-004 — Medium — Phòng trả sớm, dọn sạch vẫn bị ẩn khỏi tìm phòng

- Vai trò: khách, lễ tân.
- Chức năng: tìm phòng sau checkout sớm.
- Bước tái hiện: booking hôm nay → ba ngày sau; trả đủ tiền, checkout hôm nay; hoàn thành housekeeping để phòng CLEAN; tìm hôm nay → ngày mai.
- Mong đợi: cho phép bán lại phòng đã trả và dọn sạch theo lịch thực tế; API và exclusion constraint đồng nhất.
- Thực tế: availability không trả phòng do vẫn xét booking CHECKED_OUT theo ngày checkout dự kiến; database mới đã loại CHECKED_OUT khỏi exclusion constraint. Ca database 29 thất bại theo kỳ vọng cũ, không nên sửa constraint chỉ để làm test xanh.
- Bằng chứng: `evidence/supplemental-api.json` AVAIL-01; `evidence/exploratory-api.json` BILL-04/HK-02 chứng minh checkout và CLEAN; `evidence/database-tests.log`.
- Code: `src/rooms/rooms.service.ts:38`; `prisma/migrations/202611040004_stay_segments_and_transfer/migration.sql:29`.
- Ưu tiên: P2, ảnh hưởng doanh thu và tính nhất quán inventory.

## QA-005 — Medium — HOLD_LIMIT trả HTTP 500 thay vì 429

- Vai trò: khách tạo nhiều booking, nhiều khách chung IP.
- Chức năng: `POST /api/bookings`.
- Bước tái hiện: cùng một guest tạo hai booking online chưa thanh toán, hai phòng không trùng; tạo booking thứ ba hợp lệ trên phòng khác trong cùng thời điểm.
- Mong đợi: 429 và lời nhắc thanh toán/hủy booking đang giữ; không hiển thị lỗi máy chủ.
- Thực tế: 500 `Internal server error`; PostgreSQL từ chối bằng SQLSTATE P0001/HOLD_LIMIT. Không tạo thêm booking vượt limit, nhưng khách nhận thông báo sai. Regression bị nhiều lỗi dây chuyền khi chung IP đạt limit.
- Bằng chứng: `evidence/supplemental-api.json` HOLD-01; log PostgreSQL trích an toàn trong `evidence/database-errors-summary.txt`.
- Code: `src/common/database/postgres-code.ts:7` chỉ allowlist SQLSTATE khác, không có P0001; `src/bookings/booking-errors.ts:8` có xử lý P0001 nhưng không nhận được code.
- Ưu tiên: P2.

## QA-006 — Medium — Danh sách booking khách tràn ngang mobile

- Vai trò: guest.
- Đường dẫn: `/guest/bookings`, viewport 390×844/900 và 320×900.
- Bước tái hiện: tài khoản có booking đang ở và booking lịch sử/quá hạn; dùng reference dài hợp lệ, ví dụ UUID legacy hoặc chuỗi QA dưới giới hạn 40 ký tự; mở danh sách ở 390px.
- Mong đợi: card, nút và mã booking nằm trong viewport, mã dài wrap/truncate mà vẫn copy được.
- Thực tế: document scrollWidth 438 với innerWidth 390; card quá hạn rộng 421,625px, nút/copy và liên kết bị đẩy ra ngoài. Test UI-02 còn ghi nhận overflow của các route/viewport cụ thể trong errors, không suy rộng toàn app.
- Bằng chứng: `evidence/guest-bookings-mobile-overflow.png`, `evidence/guest-bookings-overflow.json`, UI-02 trong `evidence/exploratory-ui.json` và trace tương ứng.
- Code nghi ngờ: `frontend/src/styles.css:4149`, `:4191`, `:4369` (card, flex header/footer và nội dung không co đủ).
- Ưu tiên: P2; cần kiểm tra với reference CK ngắn và legacy dài sau sửa.

## QA-007 — Low — Nút trang chủ gây tràn ngang ở 390px

- Vai trò: khách chưa đăng nhập.
- Đường dẫn: `/`.
- Bước tái hiện: mở trang chủ, viewport 390×844; đo document.scrollWidth hoặc kéo ngang đến nút xem tất cả phòng.
- Mong đợi: toàn bộ nút trong vùng nội dung mobile.
- Thực tế: scrollWidth 400, innerWidth 390; link `.btn-explore-all` rộng 380,406px, cạnh phải x=400,406px.
- Bằng chứng: `evidence/home-mobile-layout.json`, `evidence/home-mobile-overflow.png`; baseline responsive home 390/320 cũng FAIL.
- Code nghi ngờ: `frontend/src/pages/home-page.tsx:344`, `frontend/src/styles.css:6724` (padding ngang và độ rộng intrinsic của nút).
- Ưu tiên: P3.

## QA-008 — Medium — Cam kết session trong README trái hành vi thực tế

- Vai trò: mọi tài khoản, người vận hành đánh giá bảo mật.
- Chức năng: login, reload, lưu JWT.
- Bước tái hiện: đăng nhập trên browser context mới; kiểm tra có accessToken trong localStorage key `an-nhien.auth-session`; reload trang `/guest/bookings`.
- Mong đợi theo README dòng 100: token chỉ ở bộ nhớ, không ghi storage và reload cần login. Nếu persistence là yêu cầu mới phải cập nhật kiến trúc/bảo mật và test tương ứng.
- Thực tế: token được lưu localStorage và phiên được khôi phục qua `/auth/me`. UI-07 replay xác minh restore; UI-10 FAIL khi đối chiếu cam kết memory-only.
- Bằng chứng: `evidence/session-storage-check.json` chỉ chứa boolean, không lộ token; `evidence/ui-replay.json`; trace UI-10.
- Code: `frontend/src/features/auth/auth-provider.tsx:8`, `:34`, `:71`; `README.md:100`.
- Đánh giá: đây là sai lệch tài liệu/thiết kế bảo mật đã chứng minh, **không phải bằng chứng khai thác XSS hoặc chiếm tài khoản**. Cần BA/product quyết định chính sách session.
- Ưu tiên: P2.

## QA-009 — Low — Dialog trả phòng mất tên khách đã có hồ sơ

- Vai trò: lễ tân/admin.
- Đường dẫn: `/reception/bookings/:id/billing` → Xác nhận trả phòng.
- Bước tái hiện: tạo walk-in chọn khách đã có tên `QA Audit other`; xác nhận thu đủ tiền; phát hành invoice; mở dialog trả phòng.
- Mong đợi: tên khách trùng header/hồ sơ đang xử lý.
- Thực tế: header hiển thị QA Audit Other nhưng dialog hiển thị Khách Tại Quầy. Reference/phòng/số tiền đúng và checkout vẫn thành công.
- Bằng chứng: `evidence/reception-prepaid-invoice.png`, `evidence/checkout-dialog-customer-name.png`, `evidence/reception-full-workflow-trace.zip`.
- Code: `frontend/src/features/reception/reservation-panels.tsx:164` đọc `preview.booking.customer`/`invoice.booking.customer`, trong khi các response này không có customer; preview có guestSummary riêng.
- Ưu tiên: P3.

## QA-010 — Medium — Bộ regression không còn phản ánh luồng đang triển khai

- Vai trò: QA/developer/release owner.
- Chức năng: release gate, không phải một endpoint lỗi riêng.
- Bước tái hiện: chạy nguyên bộ test trên cluster QA bằng lệnh TEST_PLAN.
- Mong đợi: test cập nhật theo nghiệp vụ đã duyệt, fixture không làm nhiễu qua limiter/pagination; không cần đổi source sản phẩm để chiều kỳ vọng cũ.
- Thực tế: backend 47/360 FAIL, Playwright 44/72 FAIL, database 2/38 FAIL. Một phần do lỗi sản phẩm QA-002/005; nhiều ca do `/guest` đã redirect `/`, `.guest-room`/`.desk-stats` và nhãn/nút cũ, giả định xác nhận booking chưa thanh toán, kỳ vọng signAsync không có expiresIn. Board test lấy fixture ở trang đầu nhưng dữ liệu additive có thể đẩy sang trang khác.
- Bằng chứng: `evidence/backend-tests.json`, `evidence/playwright-baseline.json`, `evidence/database-tests.log`, `evidence/exploratory-ui-initial.json` so với `evidence/ui-replay.json`.
- Code ví dụ: `frontend/tests/fixtures.ts:9`, `frontend/tests/guest.e2e.ts:16`, `tests/backend/auth-service.spec.ts:39`, `tests/database/integrity.test.ts:156`; exact location/stack ở JSON/log (compiled line không luôn bằng TS line).
- Chưa khẳng định mọi failure đã phân loại tận gốc; lỗi fixture/harness không được tính là bug sản phẩm mới. Không sửa test/source trong đợt audit.
- Ưu tiên: P2 để gate demo/release đáng tin cậy.

## Thứ tự sửa đề xuất

1. QA-001, QA-002, QA-003: sai tiền, runtime không chạy được nghiệp vụ, nhận booking vào phòng chưa sẵn sàng.
2. QA-004, QA-005, QA-006; đồng thời chốt chính sách session QA-008 và phục hồi regression QA-010.
3. QA-007 và QA-009.

Không phát hiện Critical đã được chứng minh trong phạm vi chạy. Điều đó không đồng nghĩa hệ thống không có lỗ hổng Critical ngoài phạm vi kiểm tra.
