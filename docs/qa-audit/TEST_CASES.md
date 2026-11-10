# Danh mục test case

Ngày 10/11/2026. Preconditions, quy trình theo nhóm và oracle chi tiết xem [TEST_PLAN.md](TEST_PLAN.md). Case ID ánh xạ trực tiếp script và JSON evidence; status trong bảng là kết quả mới nhất, không cộng số lần rerun. Các ca baseline đầy đủ nằm trong các JSON/log được liên kết ở TEST_RESULTS.

Bước thực thi có thể tái chạy: API chính trong scripts/exploratory-api.mjs, bổ sung trong scripts/supplemental-api.mjs; UI trong scripts/exploratory-ui.spec.mjs. Mỗi assertion kiểm tra status HTTP, số tiền/trạng thái hoặc database như tên ca mô tả. Chi tiết request/response đã bỏ token ở JSON.

| ID | Kịch bản / kết quả cần đạt | Lớp | Kết quả | Bằng chứng |
|---|---|---|---|---|
| AUTH-01 | Anonymous protected endpoint 401 | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| AUTH-02 | Registration cannot assign ADMIN | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| AUTH-03 | Profile cannot change role | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| DATE-01 | Reject invalid booking {"checkIn":"2026-11-09"} | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| DATE-02 | Reject invalid booking {"checkOut":"2026-11-10"} | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| DATE-03 | Reject invalid booking {"checkIn":"2027-02-30"} | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| DATE-04 | Reject invalid booking {"guests":3} | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| DATE-05 | Reject invalid booking {"guests":0} | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| DATE-06 | Reject invalid booking {"guests":1.5} | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| DATE-07 | Reject invalid booking {"totalRoomAmount":"1","status":"CONFIRMED"} | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| BOOK-01 | Three-night web booking snapshots 1950000 and pending hold | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| OWN-detail | Other guest cannot read  | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| OWN-/payment-state | Other guest cannot read /payment-state | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| OWN-/billing-preview | Other guest cannot read /billing-preview | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| OWN-/stay-history | Other guest cannot read /stay-history | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| OWN-CANCEL | Other guest cannot cancel | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| PAY-01 | Unpaid booking cannot confirm/check in | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| PAY-02 | Concurrent payment starts use one DB attempt | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| PAY-03 | Insufficient PAID cannot confirm | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| PAY-04 | Full mock payment plus duplicate webhook records once | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| PAY-05 | Unsigned webhook rejected | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| PAY-06 | Paid booking cancellation blocked | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| STAY-01 | Reception check-in and guest see same status | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| SVC-01 | Guest order quantity 2 totals 90000 | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| SVC-02 | Foreign order hidden | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| SVC-03 | Negative or duplicate service items rejected | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| BILL-01 | Pending service blocks invoice and checkout | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| STAY-02 | Guest checkout request visible to reception | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| SVC-04 | Complete service then invoice credits prepaid room exactly once | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| BILL-02 | Partial payment leaves debt; duplicate key same receipt | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| BILL-03 | Two concurrent final receipts cannot overpay | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| BILL-04 | Checkout produces DIRTY room and one TODO task | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| HK-01 | Only reception assigns; other worker cannot start | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| HK-02 | Concurrent start one winner, complete sets CLEAN | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| BOOK-02 | Two guests race same room: one creation, one conflict | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| PAY-07 | Unpaid cancellation closes mock link and releases calendar | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| EXT-01 | Extension must price one added night at room rate 650000 | API + DB | **FAIL** | [evidence](evidence/exploratory-api.json) |
| EXT-02 | Conflict requires transfer and preserves next booking | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| OVER-01 | Overdue occupant blocks next guest check-in | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| OVER-02 | Public availability excludes currently overdue occupied room for today | API + DB | **FAIL** | [evidence](evidence/exploratory-api.json) |
| RBAC-01 | Guest cannot access front desk, revenue or housekeeping | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| RBAC-02 | Admin implemented operations accessible | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| HK-03 | Housekeeping cannot see customer booking details | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| ROOM-01 | Concurrent room condition writes detect stale state | API + DB | **PASS** | [evidence](evidence/exploratory-api.json) |
| AVAIL-01 | Clean checked-out room is resellable during original planned dates | API + DB | **FAIL** | [evidence](evidence/supplemental-api.json) |
| HOLD-01 | Third unpaid hold returns intentional 429 instead of 500 | API + DB | **FAIL** | [evidence](evidence/supplemental-api.json) |
| RBAC-03 | Disabled account cannot log in to real backend | API + DB | **PASS** | [evidence](evidence/supplemental-api.json) |
| DB-ROLE-01 | Documented restricted runtime grants support check-in | API + DB | **FAIL** | [evidence](evidence/supplemental-DB-ROLE-01.json) |
| PAY-FAIL-01 | Gateway failure keeps payment pending without losing room | API + DB | **PASS** | [evidence](evidence/supplemental-api.json) |
| PAY-CANCEL-01 | Cancelled provider payment never confirms booking and can renew | API + DB | **PASS** | [evidence](evidence/supplemental-api.json) |
| UI-01 | new guest search registration booking and mock checkout | Playwright | **PASS** | [evidence](evidence/exploratory-ui.json) |
| UI-02 | guest desktop mobile routes and no JavaScript crash | Playwright | **FAIL** | [evidence](evidence/exploratory-ui.json) |
| UI-03 | guest places service and requests checkout | Playwright | **PASS** | [evidence](evidence/ui-replay.json) |
| UI-04 | receptionist dashboard rooms calendar bookings revenue mobile | Playwright | **PASS** | [evidence](evidence/exploratory-ui.json) |
| UI-05 | housekeeping assigned task start complete | Playwright | **PASS** | [evidence](evidence/exploratory-ui.json) |
| UI-06 | admin access and blocked guest data routes | Playwright | **PASS** | [evidence](evidence/exploratory-ui.json) |
| UI-07 | offline API failure recovery and reload session | Playwright | **PASS** | [evidence](evidence/ui-replay.json) |
| UI-08 | expired token 401 prompts fresh login | Playwright | **PASS** | [evidence](evidence/exploratory-ui.json) |
| UI-09 | invalid dates cannot submit reservation | Playwright | **PASS** | [evidence](evidence/exploratory-ui.json) |
| UI-10 | session token matches README memory-only guarantee | Playwright | **FAIL** | [evidence](evidence/ui-replay.json) |
| UI-DESK-01 | Tìm khách → cash walk-in → nhận phòng → invoice PAID → trả phòng DIRTY/TODO | Playwright + API | **PASS** | [evidence](evidence/reception-manual-playwright.json) |
| UI-HOME-01 | Trang chủ không tràn ngang tại 390px | Playwright layout | **FAIL** | [evidence](evidence/home-mobile-layout.json) |
| PAY-SANDBOX | Thanh toán trên hạ tầng payOS sandbox thật | External | **BLOCKED** | [evidence](TEST_PLAN.md) |
| PAY-SIGNATURE | Chữ ký webhook từ SDK/provider thật end-to-end | External | **BLOCKED** | [evidence](TEST_PLAN.md) |
| WORKER-AUTO | Worker expiry/reconcile tự chạy định kỳ ở daemon mode | Runtime | **NOT TESTED** | [evidence](TEST_PLAN.md) |
| PERF-01 | Tải lớn, ngâm tải và deadlock ở quy mô nhiều khách sạn | Load | **NOT TESTED** | [evidence](TEST_PLAN.md) |
| BROWSER-01 | Firefox, WebKit và mobile thiết bị thật | Browser | **NOT TESTED** | [evidence](TEST_PLAN.md) |
| OPS-01 | Backup/restore, TLS và vận hành production | Infrastructure | **NOT TESTED** | [evidence](TEST_PLAN.md) |
| ADMIN-CRUD | CRUD tài khoản/vai trò, giá phòng, dịch vụ và upload ảnh qua UI/API admin | Missing feature | **NOT TESTED** | [evidence](COVERAGE_MATRIX.md) |

## Lưu ý phạm vi từng ca

- OWN-* kiểm tra booking chi tiết, trạng thái thanh toán, preview, lịch sử và cancel bằng guest khác. SVC-02 kiểm tra đơn người khác. Invoice ownership còn có regression service/billing; không suy từ một endpoint sang mọi tài nguyên.
- PAY-04 và PAY-05 dùng mock verifier tại server. Không báo PASS cho chữ ký payOS thật.
- UI-01 thực sự click search/register/login/booking và thấy trang mock provider; xác nhận thanh toán đủ tiền nằm ở PAY-04 qua API + DB, không phải trang provider thật.
- UI-03 replay đã click cả dialog xác nhận gửi checkout; UI-05 click start/complete của người được phân công. UI-04 chỉ xác minh các trang lễ tân render và không tràn ở 390px; ca UI-DESK-01 mới kiểm tra thao tác thay đổi nghiệp vụ.
- UI-07 replay kiểm tra **khôi phục phiên sau reload** đúng hành vi hiện có; UI-10 riêng kiểm tra sự không phù hợp với README memory-only.
- UI-08 mô phỏng response 401 để kiểm tra frontend; JWT thật hết hạn được kiểm tra bởi auth.e2e-spec hiện có.
- UI-09 chỉ kiểm tra URL chứa ngày đảo không tự phát sinh POST, không thay thế test submit form đầy đủ. DATE-* kiểm tra server từ chối dữ liệu sai, ngày quá khứ, quá sức chứa và mass assignment.
- EXT-01 cố ý dùng oracle giá phòng 650.000đ để phát hiện hardcode; test gia hạn có sẵn mong 1.000đ nên PASS của nó không bác bỏ bug. EXT-02 chỉ PASS về tính nguyên tử chuyển phòng/bảo vệ lịch, không PASS về giá.
- OVER-01 PASS vì walk-in từ chối phòng quá hạn 409; OVER-02 FAIL vì public search vẫn quảng cáo phòng ấy.
- DB-ROLE-01 bản đầu lỗi SQL của harness 42P08 đã được sửa trong script audit và chạy lại; kết luận chỉ dựa vào lần tái hiện 42501 trong supplemental-DB-ROLE-01.json.
