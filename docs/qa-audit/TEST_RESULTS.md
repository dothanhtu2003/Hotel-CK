# Kết quả QA audit Hotel-CK

**Chưa sẵn sàng demo toàn diện hoặc release không giám sát.** Luồng cơ bản đã có bằng chứng chạy thực tế, nhưng còn sai tiền gia hạn, grants runtime và sai lệch tồn phòng cần sửa trước. Không sửa mã nguồn hoặc test có sẵn trong đợt này. Không gọi production/payOS thật.

Ngày 10/11/2026, UTC+7. Đánh giá working tree có thay đổi sẵn trước audit. Xem [bug report](BUG_REPORT.md), [ma trận chức năng](COVERAGE_MATRIX.md), [kế hoạch](TEST_PLAN.md).

## Kết quả chạy bộ hiện có

| Bộ kiểm thử | PASS | FAIL | BLOCKED | NOT TESTED | Bằng chứng |
|---|---:|---:|---:|---:|---|
| Database native PostgreSQL | 36 | 2 | 0 | 0 | [log](evidence/database-tests.log) |
| Backend Jest unit/integration | 313 | 47 | 0 | 0 | [JSON](evidence/backend-tests.json), [log](evidence/backend-tests.log) |
| Frontend Vitest | 224 | 0 | 0 | 0 | [JSON](evidence/frontend-unit.json) |
| Playwright hiện có, Chrome | 28 | 44 | 0 | 0 | [JSON](evidence/playwright-baseline.json), [log](evidence/playwright-baseline.log) |

Backend và frontend typecheck đều exit 0: [backend](evidence/backend-typecheck.log), [frontend](evidence/frontend-typecheck.log). Không gọi typecheck là kiểm chứng nghiệp vụ. Không chạy production build/deployment hay pentest hạ tầng.

Các FAIL trên là **kết quả runner thô**, gồm product bug, fixture bị limiter và test kỳ vọng/selector lỗi thời. Không tuyên bố đã thực thi phần nghiệp vụ sau bước setup thất bại. Backend auth 28/28, booking-payment 13/13, stay-extension 7/7, service-orders integration 38/38; ghi rõ mocks và oracle giá trong COVERAGE_MATRIX. Chi tiết từng assertion của toàn bộ bộ test nằm trong JSON, không chỉ tên suite.

## Ca khám phá độc lập và theo vai trò

| Nhóm | PASS | FAIL | Ghi chú |
|---|---:|---:|---|
| API + PostgreSQL độc lập | 42 | 2 | 44 ca, giá, ownership, concurrency, tiền/dịch vụ, checkout, housekeeping, extension |
| API/SQL bổ sung | 3 | 3 | 6 ca; restricted role dùng lần replay đã sửa lỗi harness |
| Playwright unique UI-01..10 | 8 | 2 | Kết quả cuối sau hiệu chỉnh selector/đủ bước dialog, không sửa app |
| Playwright lễ tân tương tác bổ sung | 1 | 0 | Walk-in → invoice → checkout; trace riêng |
| Đo layout trang chủ mobile | 0 | 1 | scrollWidth 400 / viewport 390 |

Hai ca **BLOCKED**: payOS sandbox thật và chữ ký provider thật. Năm nhóm **NOT TESTED** chi tiết ở TEST_CASES; nhóm ADMIN-CRUD không có triển khai để chạy. Tổng registry riêng (không trộn baseline): {"PASS":54,"FAIL":8,"BLOCKED":2,"NOT TESTED":5}. Không dùng tỷ lệ này làm phần trăm hoàn thiện sản phẩm.

### Luồng đã chứng minh

- Khách mới: search, đăng ký, login quay lại phòng, báo giá ba đêm 1.950.000đ, tạo PENDING và chuyển trang payOS mock bằng UI. Mock/API đủ tiền mới CONFIRMED; thiếu tiền không confirm; webhook lặp không thêm receipt.
- Khách đang ở: đặt dịch vụ 2×45.000đ, xem thông tin, gửi checkout request và lễ tân đọc thấy cùng dữ liệu. UI và API được kiểm tra riêng.
- Lễ tân: check-in, pending service chặn invoice/checkout, invoice credit prepayment đúng một lần, partial payment giữ nợ, same-key retry không thu trùng, hai receipt cuối đồng thời chỉ một thành công. Chuỗi UI cash walk-in tạo CHECKED_IN, phát hành invoice PAID balance=0, checkout trả DIRTY + TODO.
- Buồng phòng: staff assign, worker khác bị từ chối, start/complete chuyển CLEANING/CLEAN; concurrent start một 200 một 409. UI-05 thực hiện đầy đủ hai dialog. Nhân viên chỉ làm việc được giao, không có self-claim endpoint.
- Admin: truy cập các chức năng front desk/booking/revenue/housekeeping hiện có, guest route bị chặn; không có bằng chứng CRUD cấu hình/vai trò.
- Bảo mật: anonymous 401, guest staff API 403, ownership 404, role/price/status injection 400; backend có kiểm tra JWT sai/hết hạn, live role/status. Không thấy vượt quyền ở các ca đã chạy. Token localStorage trái README, ghi QA-008; không có bằng chứng khai thác XSS từ đó.
- Mất kết nối/API 401: UI retry khôi phục được; 401 xóa phiên và yêu cầu login; reload hợp lệ khôi phục phiên hiện tại. Desktop/mobile lễ tân được chụp; guest có overflow ở 390/320. Không có pageerror JavaScript trong vòng quét UI-02, nhưng render không lỗi không chứng minh mọi nút đều đúng.

### Các lỗi cần ưu tiên

High: QA-001 giá gia hạn 1.000đ; QA-002 runtime grants thiếu bảng lịch sử; QA-003 public availability nhận phòng quá hạn. Medium: QA-004 phòng trả sớm bị giữ trên search, QA-005 limit trả 500, QA-006 guest mobile overflow, QA-008 session docs/security mismatch, QA-010 regression stale. Low: QA-007 home overflow, QA-009 tên khách trong dialog. Chi tiết tái hiện, expected/actual và code ở BUG_REPORT.

### Độ tin cậy và dữ liệu còn giữ

Kết quả exploratory chính thức chạy ở 55440 để tách limiter/pagination khỏi regression 55439. Lần dùng chung cluster ban đầu và các lỗi harness được giữ để minh bạch, **loại khỏi kết quả cuối**. Chữ ký mock không xác minh SDK payOS; không dùng sandbox ngân hàng thật. Phiên NODE_ENV=test không chạy scheduler background, dù phương thức expiry/reconcile có test mô phỏng.

Source app không được chỉnh sửa. git status đầu/cuối cùng danh sách thay đổi sẵn có (17 tracked files và một untracked app.test.tsx); compiled dist/dist-tests và dữ liệu QA là artifacts phát sinh. Thư mục docs/qa-audit đang bị .gitignore hiện có bỏ qua; các báo cáo vẫn tồn tại trên disk, không thay .gitignore hoặc git add.

Bằng chứng gồm screenshots, trace.zip, HTTP/DB JSON, OpenAPI và log; artifacts có dữ liệu tài khoản giả và có thể chứa token test trong trace, không chứa khóa payOS production. DB dữ liệu giả được giữ dưới .local/qa-audit để xem lại. Danh mục và hash source ở evidence/source-inventory.json; snapshot DB kết thúc ở evidence/final-database-snapshot.json.

## Đánh giá demo

Có thể demo có hướng dẫn luồng đã PASS trên database QA và provider mock. **Chưa duyệt demo toàn bộ hệ thống với giá/room inventory thật**. Cần chốt/sửa QA-001/002/003, thống nhất availability, sửa mobile chính, thống nhất session và phục hồi regression trước vòng xác nhận tiếp theo. Không tuyên bố 100% vì còn BLOCKED/NOT TESTED và các bước regression chưa đi qua do setup/selector.

Kết thúc audit: đã đóng browser, dừng API/Vite QA và cả hai cluster PostgreSQL do audit tạo. Dữ liệu và bằng chứng vẫn được giữ; xem [cleanup](evidence/cleanup.txt). Kiểm tra năm báo cáo bắt buộc và liên kết Markdown nội bộ không có đường dẫn thiếu.
