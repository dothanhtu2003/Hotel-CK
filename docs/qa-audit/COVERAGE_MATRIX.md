# Ma trận chức năng và phạm vi thực triển khai

Đối chiếu code/router/controller/schema và kiểm thử ngày 10/11/2026; README chỉ là tham chiếu. **Có triển khai** không đồng nghĩa PASS. G=guest, R=receptionist, H=housekeeping, A=admin; “riêng” nghĩa tài nguyên thuộc tài khoản.

| Chức năng thực có | Public | G | R | H | A | Phạm vi đã chạy / kết luận |
|---|---|---|---|---|---|---|
| Danh mục phòng, ảnh read-only, giá, tầng, sức chứa, số giường | Có | Có | Có | Có | Có | UI-01, room API/regression; ảnh/amenities có fallback minh họa, không suy là dữ liệu cấu hình đầy đủ |
| Availability theo ngày/khách/type, báo giá nhiều đêm | Có | Có | Có | Có | Có | Có triển khai; DATE-* PASS; QA-003/004 FAIL logic tồn phòng |
| Đăng ký guest, login, đọc/sửa hồ sơ tên/SĐT, logout client | Có auth | Riêng | Riêng | Riêng | Riêng | UI registration PASS, auth integration 28/28; token persistence QA-008 |
| Tạo booking web online, giá snapshot, hold 15 phút | Không | Riêng | Qua walk-in | Không | Qua walk-in | BOOK-01 PASS, QA-005 FAIL thông báo giới hạn |
| My booking, detail, status filter, billing, stay history | Không | Riêng | Toàn bộ | Không | Toàn bộ | OWN-* PASS; UI mobile QA-006 |
| Cancel unpaid / cấm cancel đã thu tiền | Không | Riêng | Có | Không | Có | PAY-06/07 PASS; không có hoàn tiền booking tự động |
| Booking list/search/paging, phone/reference/email/room | Không | Không | Có | Không | Có | Backend phần search/role có chạy; một số regression setup/selector fail; UI list render PASS |
| Xác nhận/nhận phòng, chặn chưa đủ tiền/ngày sai/khách đang ở | Không | Không | Có | Không | Có | PAY-01/STAY-01/OVER-01 PASS; runtime role QA-002 |
| Walk-in chọn khách cũ/tạo hồ sơ, thu đủ tiền/cash hoặc payOS | Không | Không | Có | Không | Có | UI-DESK-01 cash PASS; bank mock integration; không thu tiền thật |
| Dashboard KPI, room board, tape chart, notification request | Không | Không | Có | Board được giao | Có | UI-04 render desktop/mobile PASS; realtime không phải bằng chứng WebSocket/push |
| Gia hạn, quote token, chuyển phòng, lịch sử segment | Không | Không | Có | Không | Có | EXT-02 PASS tính nguyên tử/lịch; EXT-01 FAIL giá; regression giá 1.000đ không đủ oracle |
| Phòng bảo trì/sạch thủ công, audit và hoàn tất task có xác nhận | Không | Không | Có | Không | Có | ROOM-01 PASS concurrency; front-desk regression có ca manual clean PASS |
| Catalog dịch vụ active, giá snapshot, order nhiều item | Catalog | Đang ở | Có | Không | Có | SVC-* PASS; quantity/duplicates và ownership được kiểm tra |
| Thanh toán riêng dịch vụ CASH/payOS, deliver, cancel/refund có xác nhận | Không | Yêu cầu riêng | Xử lý | Không | Xử lý | Service integration 38/38, service-payos unit 11/11; UI-03 đặt CASH PASS; không test giao tiền thật |
| Yêu cầu trả phòng | Không | Riêng khi đang ở | Xem/xử lý | Không | Xem/xử lý | STAY-02 và UI-03 replay PASS; không tự checkout |
| Billing preview, issue invoice, credit prepayment, split payment/key | Không | Xem riêng | Thu/xử lý | Không | Thu/xử lý | SVC-04/BILL-02/03 PASS, kiểm tra DB số tiền |
| payOS booking/invoice/service start/sync/cancel và webhook | Webhook | Riêng | Có theo endpoint | Không | Có theo endpoint | Logic mock PASS có giới hạn; provider/chữ ký thật BLOCKED |
| Review tiền booking đến muộn, lưu reference xử lý refund | Không | Xem trạng thái | Có | Không | Có | Có API; booking-payment integration có review PASS; không chuyển tiền hoàn tự động |
| Checkout nợ=0, pending/delivery service chặn checkout | Không | Không | Có | Không | Có | BILL-01..04, UI-DESK-01 PASS; grants runtime FAIL |
| Tạo TODO/DIRTY sau checkout; assign/start/complete → CLEANING/CLEAN | Không | Không | Tạo/assign/manual | Chỉ task được giao | Tạo/assign/manual | HK-01/02 và UI-05 PASS; không có self-claim cho task chưa giao |
| Doanh thu thu thực tế, breakdown room/service/refund, khoảng ngày | Không | Không | Có | Không | Có | UI revenue render PASS; baseline revenue suite chạy, kết quả chi tiết JSON; không kiểm toán kế toán độc lập toàn bộ công thức |
| RBAC live DB, ownership, whitelist DTO, rate limit, JWT expiry | Public rules | Scope | Scope | Scope | Scope | Auth/RBAC/OWN PASS ở các ca cụ thể; không phải pentest toàn hệ thống |
| Health DB và OpenAPI | Có | Có | Có | Có | Có | health integration 7/7; schema thực chụp kèm |

## Không tìm thấy triển khai hoàn chỉnh

- Admin CRUD tài khoản, cấp/đổi role, disable account qua UI/API; CRUD room/room-type/price/service catalog; upload/delete ảnh. Hiện có Prisma data và seed/SQL không đồng nghĩa có màn hình quản trị.
- Hoàn tiền booking tự động qua ngân hàng/payOS; endpoint resolve chỉ ghi nhận reference xử lý bên ngoài.
- Quên/reset mật khẩu, email verification, gửi email/SMS booking; multi-property, channel manager, loyalty, promotion/discount/tax engine cấu hình. Không tự bịa kịch bản PASS cho những phần này.
- Housekeeping tự nhận task chưa phân công. Chỉ R/A assign, H làm task của mình; đây là khác biệt yêu cầu cần BA xác nhận, không tự gọi bug nếu chưa có đặc tả.
- Generic /admin/:feature và staff :feature có trang ComingSoon, không xem placeholder là module hoàn thiện.

## Chưa thể/chưa kiểm thử

| Phạm vi | Trạng thái | Nguyên nhân |
|---|---|---|
| Provider sandbox/payOS thật và chữ ký thật | BLOCKED | Không có kênh/keys sandbox được xác minh; cố ý không dùng production |
| Browser UI | Đã chạy | Chrome/Playwright thực; không BLOCKED toàn UI |
| Tự chạy background timer, reconciliation dài hạn | NOT TESTED | NODE_ENV=test tắt timer; phương thức được gọi trực tiếp trong integration/mock |
| Load lớn, soak, backup/restore, deployment thực, TLS | NOT TESTED | Ngoài các concurrency 2 request đã chạy |
| Safari/Firefox, accessibility đầy đủ, thiết bị mobile thật | NOT TESTED | Chỉ Chrome và viewport simulation |
| Toàn bộ nút trên mọi tổ hợp role/date/status | NOT TESTED | Có thao tác đại diện và negative cases, chưa duyệt tất cả tổ hợp |

## Bề mặt API thực có

Danh mục dưới lấy từ OpenAPI của server thực, xác minh role qua controller. G/R/A không có nghĩa tất cả thao tác đều áp dụng cho booking bất kỳ: guest vẫn chịu ownership và trạng thái nghiệp vụ. Một số DTO payOS/revenue khai báo inline nên OpenAPI không phải đặc tả đầy đủ mọi field.

| Method | Route | Vai trò |
|---|---|---|
| GET | `/api/health` | Public |
| GET | `/api/front-desk/available` | R/A |
| GET | `/api/front-desk/room-filters` | R/A |
| GET | `/api/front-desk/dashboard` | R/A |
| GET | `/api/front-desk/booking-counts` | R/A |
| GET | `/api/front-desk/billing` | R/A |
| GET | `/api/front-desk/bookings` | R/A |
| GET | `/api/front-desk/bookings/{id}` | R/A |
| GET | `/api/front-desk/orders` | R/A |
| GET | `/api/front-desk/rooms` | R/A |
| PATCH | `/api/front-desk/rooms/{id}/condition` | R/A |
| GET | `/api/front-desk/customers` | R/A |
| POST | `/api/front-desk/walk-in` | R/A |
| GET | `/api/rooms` | Public |
| GET | `/api/rooms/available` | Public |
| GET | `/api/rooms/{id}` | Public |
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | G/R/H/A |
| GET | `/api/users/me` | G/R/H/A |
| PATCH | `/api/users/me` | G/R/H/A |
| GET | `/api/bookings/{id}/stay-history` | G riêng / R / A |
| POST | `/api/bookings/{id}/extension-preview` | R/A |
| PATCH | `/api/bookings/{id}/extend` | R/A |
| POST | `/api/bookings` | G |
| GET | `/api/bookings` | R/A |
| GET | `/api/bookings/my` | G |
| GET | `/api/bookings/checkout-requests` | R/A |
| PATCH | `/api/bookings/{id}/request-checkout` | G |
| GET | `/api/bookings/{id}` | G riêng / R / A |
| PATCH | `/api/bookings/{id}/cancel` | G riêng / R / A |
| PATCH | `/api/bookings/{id}/confirm` | R/A |
| PATCH | `/api/bookings/{id}/check-in` | R/A |
| GET | `/api/bookings/{id}/billing-preview` | G riêng / R / A |
| POST | `/api/bookings/{id}/invoice` | R/A |
| GET | `/api/bookings/{id}/invoice` | G riêng / R / A |
| PATCH | `/api/bookings/{id}/check-out` | R/A |
| GET | `/api/invoices/{id}` | G riêng / R / A |
| POST | `/api/invoices/{id}/payments` | R/A |
| GET | `/api/payments/booking-reviews` | R/A |
| POST | `/api/payments/booking-reviews/{id}/resolve` | R/A |
| GET | `/api/bookings/{id}/payment-state` | G riêng / R / A |
| POST | `/api/bookings/{id}/payos` | G riêng / R / A |
| POST | `/api/bookings/{id}/payos/qr` | G riêng / R / A |
| POST | `/api/bookings/{id}/payos/sync` | G riêng / R / A |
| POST | `/api/bookings/{id}/payos/cancel` | G |
| POST | `/api/invoices/{id}/payos` | G riêng / R / A |
| POST | `/api/invoices/{id}/payos/cancel` | R/A |
| POST | `/api/invoices/{id}/payos/sync` | G riêng / R / A |
| POST | `/api/service-orders/{id}/payos` | G riêng / R / A |
| POST | `/api/service-orders/{id}/payos/sync` | G riêng / R / A |
| POST | `/api/service-orders/{id}/payos/cancel` | G riêng / R / A |
| POST | `/api/payments/payos/webhook` | Public |
| GET | `/api/revenue` | R/A |
| GET | `/api/services` | Public |
| GET | `/api/services/{id}` | Public |
| POST | `/api/service-orders` | G riêng / R / A |
| GET | `/api/service-orders` | R/A |
| GET | `/api/service-orders/my` | G |
| GET | `/api/service-orders/{id}` | G riêng / R / A |
| PATCH | `/api/service-orders/{id}/complete` | R/A |
| PATCH | `/api/service-orders/{id}/collect-and-deliver` | R/A |
| PATCH | `/api/service-orders/{id}/deliver` | R/A |
| PATCH | `/api/service-orders/{id}/settle` | R/A |
| PATCH | `/api/service-orders/{id}/cancel` | G riêng / R / A |
| GET | `/api/housekeeping/staff` | R/A |
| GET | `/api/housekeeping/board` | R/H/A (H scoped) |
| GET | `/api/housekeeping/tasks` | R/H/A (H scoped) |
| POST | `/api/housekeeping/tasks` | R/A |
| GET | `/api/housekeeping/tasks/{id}` | R/H/A (H scoped) |
| PATCH | `/api/housekeeping/tasks/{id}/assign` | R/A |
| PATCH | `/api/housekeeping/tasks/{id}/start` | H được giao |
| PATCH | `/api/housekeeping/tasks/{id}/complete` | H được giao |

Tổng 73 operations theo OpenAPI đã chạy. Đây là inventory implementation, không phải 73 endpoint đã được audit đầy đủ mọi nhánh. Trace/log và case registry quyết định trạng thái thực thi.
