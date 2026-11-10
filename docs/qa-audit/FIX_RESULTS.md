# Kết quả sửa QA Audit Hotel-CK

Ngày 10/11/2026, working tree hiện tại. **QA-001 đến QA-009 đã xử lý và có kiểm chứng; QA-010 chưa hoàn tất toàn bộ Playwright cũ. Không xác nhận release/demo toàn diện đã đạt gate.**

## Theo từng phát hiện

| QA ID | Nguyên nhân và cách xử lý | File chính | Bằng chứng / trạng thái |
|---|---|---|---|
| QA-001 | Yêu cầu mới xác nhận mức gia hạn/quá hạn/chuyển phòng cố định 1.000đ, vì vậy oracle audit 650.000đ không còn đúng. Giữ cách cộng phần tăng, đổi tên TEST_NIGHTLY_RATE thành EXTENSION_NIGHTLY_RATE và ghi chính sách rõ trong README. Không đổi giá snapshot ban đầu. | src/bookings/stay-extension.ts; README.md; tests/backend/qa-fixes.e2e-spec.ts | **PASS**: phòng 650.000đ thêm một đêm = 1.000đ; tổng 651.000đ. Stay-extension integration 7/7 kiểm tra thường/quá hạn/chuyển phòng, tiền đã trả, idempotency và race. |
| QA-002 | Template thiếu bảng và cột mới. Thêm SELECT/INSERT cho lịch sử/room audit; UPDATE đúng cột cho segment, room transfer, yêu cầu checkout, receipt/service delivery và payment checkout flag. Thêm hai migration mới; không sửa migration cũ trong repository. | scripts/release-runtime-grants.sql; prisma/migrations/202611100001_qa_room_readiness/migration.sql; 202611100002_qa_receipt_grants/migration.sql | **PASS**: DB test 39 chạy role NOLOGIN không sở hữu schema: check-in, thu dịch vụ, checkout request, gia hạn, chuyển phòng, invoice/payment, checkout; role không DELETE lịch sử/đổi role user. Test 37 và supplemental DB-ROLE-01 cũng PASS. UUID defaults, không cần cấp sequence/SUPERUSER/DDL. |
| QA-003 | Public search trước đây không chặn CHECKED_IN quá hạn. Dùng cùng điều kiện readiness cho hôm nay ở public/front desk; thêm lock + kiểm tra khi tạo web booking; trigger mới khóa phòng và bảo vệ INSERT phía DB. | src/rooms/rooms.service.ts; src/bookings/bookings.service.ts; src/database/queries.ts; migration 001 | **PASS**: public search không có phòng quá hạn; web và walk-in 409; cùng phòng đồng thời chỉ một booking. Ca mới và audit API kiểm tra thực tế. Phòng dơ/open task hôm nay bị chặn; đặt ngày tương lai vẫn được phép. |
| QA-004 | Availability vẫn coi CHECKED_OUT là giữ lịch trong khi exclusion constraint đã giải phóng. Loại CHECKED_OUT khỏi truy vấn ORM/native SQL; vẫn kiểm tra CLEAN, không có người và không open task khi nhận ngay. | src/rooms/rooms.service.ts; src/database/queries.ts; tests/database/integrity.test.ts | **PASS**: trả sớm còn DIRTY không bán; sau dọn CLEAN availability có phòng và tạo booking mới 201. Giữ nguyên booking cũ/lịch sử. |
| QA-005 | Extractor không nhận SQLSTATE P0001 nên nhánh HOLD_LIMIT 429 không chạy. Bổ sung P0001, giữ nguyên các giới hạn hiện có. | src/common/database/postgres-code.ts; tests/backend/qa-fixes.e2e-spec.ts | **PASS**: hai hold hợp lệ, hold thứ ba 429, DB chỉ có hai booking; supplemental HOLD-01 PASS. |
| QA-006 | Flex card/reference không co và header/lưới dịch vụ có min-width vượt 320px. Cho wrap/co card, reference, actions; điều chỉnh gap header nhỏ và grid minmax(0,1fr) tại mobile. Copy reference vẫn giữ nguyên hành vi. | frontend/src/styles.css; frontend/tests/qa-audit.e2e.ts | **PASS**: vòng quét guest bookings/detail/billing/services/orders/profile ở 1440/390/320 không tràn, không pageerror; có screenshot/trace. |
| QA-007 | Nút xem toàn bộ phòng có intrinsic width và padding gây overflow; header đã đăng nhập cũng vượt 320px. Cho wrap và giới hạn width; thu gap/padding chỉ dưới 360px. | frontend/src/styles.css | **PASS**: home anonymous 320/390/1440; home đăng nhập đo 320/320. Không ẩn toàn trang bằng overflow-x:hidden. |
| QA-008 | README/test cũ nói memory-only dù implementation đã persist localStorage. Giữ cơ chế hiện có, cập nhật README, sơ đồ và test reload/401/expiry/logout. Ghi rõ rủi ro cùng-origin script đọc token. | README.md; frontend/tests/auth.e2e.ts; frontend/tests/qa-audit.e2e.ts | **PASS**: auth suite restore qua auth/me, localStorage có session, 401 xóa session; Vitest session expiry/logout/persistence PASS. Không đưa token production vào log. |
| QA-009 | CheckoutSummary tìm customer trên DTO preview/invoice không có trường đó. Đọc customer từ front-desk booking detail, chờ tải và xử lý lỗi trước khi render summary. | frontend/src/features/reception/reservation-panels.tsx | **PASS**: UI cash walk-in chọn khách cũ, issue invoice PAID, dialog có tên QA Audit Other, checkout 200/DIRTY. Backend detail/ownership và các booking online được kiểm tra riêng; dialog checkout online riêng chưa được chạy cùng một ca UI. |
| QA-010 | Các test cũ trộn legacy unpaid booking với online prepayment, chia sẻ limiter/pagination, so sánh serverNow, dùng sidebar/form/heading cũ. Đã cập nhật backend fixtures, transport identity từng test app, danh sách owner độc lập, phân trang có scope và auth UI hiện tại. | tests/backend/*; tests/database/integrity.test.ts; frontend/tests/auth.e2e.ts; frontend/tests/fixtures.ts; frontend/tests/qa-audit.e2e.ts | **PARTIAL**: backend 365/365 PASS, auth UI 32/32 PASS. Toàn bộ 40 FAIL của lần full UI đã được phân loại; 29 ca ngoài auth còn OPEN. Xem FIX_TEST_TRIAGE.md. Không skip/xóa negative/concurrency tests. |

## Kết quả thực chạy

| Bộ kiểm thử | PASS | FAIL | Ghi chú / evidence |
|---|---:|---:|---|
| PostgreSQL database | 39 | 0 | [fix-database.log](evidence/fix-database.log), có runtime role thực và negative grants |
| Backend Jest unit/integration | 365 | 0 | [fix-backend-final.json](evidence/fix-backend-final.json), 26 suites; ca setup mới không dựa vào payment provider thật |
| Frontend Vitest | 224 | 0 | [fix-frontend-tests.log](evidence/fix-frontend-tests.log), 37 files |
| Playwright auth + regression mới | 32 | 0 | [fix-auth-final.json](evidence/fix-auth-final.json), một lần chạy cả nhóm trên fixture mới |
| Playwright hành trình/role/mobile bổ sung | 12 | 0 | [fix-ui-final.json](evidence/fix-ui-final.json), trace từng ca |
| API/DB audit chạy lại | 44 | 0 | [fix-exploratory-api.json](evidence/fix-exploratory-api.json) |
| API/SQL bổ sung | 6 | 0 | [fix-supplemental-api.json](evidence/fix-supplemental-api.json) |
| Playwright cũ toàn bộ, trước các replay/cập nhật auth cuối | 32 | 40 | [fix-playwright-full.json](evidence/fix-playwright-full.json); không trình bày số này là kết quả trên mọi sửa đổi cuối |

Không cộng các nhóm/replay để tuyên bố số ca UI độc lập hoặc phần trăm hoàn thiện. Auth 32/32 và exploratory 12/12 không thay thế toàn bộ bộ UI cũ.

Typecheck backend/frontend và build backend/frontend đã exit 0; log fix-backend-typecheck.log, fix-frontend-typecheck.log, fix-backend-build.log, fix-frontend-build.log. Targeted lint các file nghiệp vụ và test QA mới exit 0. git diff --check không có lỗi whitespace.

## Hành trình và giới hạn bằng chứng

Đã thực hiện search → đăng ký/login → đặt phòng → provider mock; API đủ tiền mới confirm; check-in → dịch vụ → gia hạn/chuyển phòng → invoice → split/idempotent/concurrent receipts → checkout → DIRTY/TODO → housekeeping CLEAN → bán lại. Phần này được kiểm tra bằng nhiều ca UI/API/DB liên kết theo fixture, **không phải một trace duy nhất bao trùm toàn bộ hành trình**. Các role GUEST, RECEPTIONIST, HOUSEKEEPING và ADMIN có kiểm tra quyền/ownership.

payOS/provider/chữ ký thật: **NOT TESTED theo yêu cầu không cần test payOS**; mọi nhánh gateway đã chạy chỉ dùng mock, không chuyển tiền ngân hàng. Load/soak, browser ngoài Chrome, thiết bị mobile thật và deploy production: NOT TESTED. Không tác động database cloud/production; không reset database cũ. Các cluster 55439, 55440, 55441 là QA local, dữ liệu cộng dồn được giữ.

Lần exploratory dùng lại cluster regression bị hold limiter làm nhiễu đã bị loại khỏi kết luận. Kết quả 44/44 + 6/6 cuối lấy từ cluster 55441 với fixture/server identity mới. Các lần harness lỗi trước được thay bằng lần tái chạy có assertion, không xem là bug sản phẩm.

## Rủi ro còn lại và điều kiện bàn giao

- QA-010 còn 29 ca UI OPEN: cần chuyển các form/heading/filter cũ sang flow hiện tại, tách booking legacy khỏi luồng thanh toán mới, kiểm tra lại từng negative và concurrency UI. Không được làm xanh bằng cách bỏ assertion hoặc đánh dấu skip. Một timeout tại selector không chứng minh chức năng phía sau đúng hoặc sai.
- Chưa xác nhận dialog trả phòng cho booking online trong một ca UI riêng; nguồn customer chung đã được dùng và API online/ownership có kiểm chứng.
- Migration mới chỉ được áp dụng trên QA local; deploy với migration owner rồi dùng runtime grants trên môi trường đích là công việc bàn giao, không được thực hiện lên production trong task này.
- localStorage giữ rủi ro token đọc được bởi script cùng origin. Đây là chính sách đã giữ theo yêu cầu, không phải bảo đảm chống XSS.
- Giá gia hạn 1.000đ là quyết định được yêu cầu rõ ràng trong lần sửa; chưa thêm chính sách giá khác hoặc tự suy ra phụ phí/chênh lệch chuyển phòng.

**Kết luận: các sửa đổi sản phẩm chính có bằng chứng PASS, nhưng QA-010 còn mở nên chưa xác nhận hoàn tất toàn bộ 10 phát hiện hoặc release gate.** Các báo cáo/evidence dưới docs/qa-audit vẫn bị .gitignore hiện có bỏ qua; có trên disk, chưa commit và không sửa .gitignore.

Đã lưu [snapshot database sau sửa](evidence/fix-final-database-snapshot.json), kiểm tra các trigger booking đều bật, và [dừng các dịch vụ QA](evidence/fix-cleanup.txt). Các thay đổi chưa commit trước task được giữ lại; không tự commit/deploy.
