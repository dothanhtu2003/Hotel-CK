# Phân loại Playwright regression

Toàn bộ 40 FAIL của lần chạy đầy đủ được liệt kê dưới đây. Các ca auth đã được sửa và chạy lại trọn nhóm: 32/32 PASS. Các ca còn OPEN không được coi là PASS chỉ vì hành trình tương đương trong bộ mới đã chạy được. Bước setup thất bại không chứng minh các bước sau.

| File / test | Phân loại | Trạng thái cuối |
|---|---|---|
| auth.e2e.ts — homepage: real local assets, active availability planner and keyboard dialog | Selector/flow assertion no longer matches the current UI; requires migration and rerun | PASS in updated auth suite |
| auth.e2e.ts — real register -> login -> auth/me -> users/me -> profile update/clear phone -> logout | Business/fixture precondition requires investigation; not classified as harmless selector failure | PASS in updated auth suite |
| auth.e2e.ts — real backend role navigation and 403 UX: guest | Business/fixture precondition requires investigation; not classified as harmless selector failure | PASS in updated auth suite |
| auth.e2e.ts — real backend role navigation and 403 UX: housekeeping | Business/fixture precondition requires investigation; not classified as harmless selector failure | PASS in updated auth suite |
| auth.e2e.ts — reload deliberately loses the in-memory session | Business/fixture precondition requires investigation; not classified as harmless selector failure | PASS in updated auth suite |
| auth.e2e.ts — authenticated 401 clears the client session after test account is disabled | Selector/flow assertion no longer matches the current UI; requires migration and rerun | PASS in updated auth suite |
| auth.e2e.ts — real offline/network error offers retry and recovers | Selector/flow assertion no longer matches the current UI; requires migration and rerun | PASS in updated auth suite |
| auth.e2e.ts — guest booking page remains connected after portal updates | Selector/flow assertion no longer matches the current UI; requires migration and rerun | PASS in updated auth suite |
| auth.e2e.ts — a real delayed profile request shows a loading state before rendering | Selector/flow assertion no longer matches the current UI; requires migration and rerun | PASS in updated auth suite |
| auth.e2e.ts — desktop staff portal renders operational cards and role-specific navigation | Business/fixture precondition requires investigation; not classified as harmless selector failure | PASS in updated auth suite |
| auth.e2e.ts — edit form validates and confirms discarding unsaved changes | Selector/flow assertion no longer matches the current UI; requires migration and rerun | PASS in updated auth suite |
| front-desk.e2e.ts — walk-in links an existing guest, shows quote, creates once, confirms and checks in | Selector/flow assertion no longer matches the current UI; requires migration and rerun | OPEN |
| front-desk.e2e.ts — walk-in creates a real customer profile and server search finds its booking | Selector/flow assertion no longer matches the current UI; requires migration and rerun | OPEN |
| front-desk.e2e.ts — walk-in reports an existing profile and dirty-room check-in is rejected without changing the booking | Selector/flow assertion no longer matches the current UI; requires migration and rerun | OPEN |
| guest.e2e.ts — homepage search → room → registration/login return → booking → cancel; ownership and pagination | Selector/flow assertion no longer matches the current UI; requires migration and rerun | OPEN |
| guest.e2e.ts — checked-in guest orders multiple services, cancels pending order, sees preview and staff-issued paid invoice | Fixture: shared guest/IP hold quota reached during setup; downstream business steps were not executed | OPEN |
| guest.e2e.ts — real booking race returns 409 and blocks duplicate submission | Fixture: shared guest/IP hold quota reached during setup; downstream business steps were not executed | OPEN |
| guest.e2e.ts — cancel handles a real state conflict and booking ownership stays hidden in UI | Fixture: shared guest/IP hold quota reached during setup; downstream business steps were not executed | OPEN |
| guest.e2e.ts — availability loading, offline recovery, empty results and responsive pages | Business/fixture precondition requires investigation; not classified as harmless selector failure | OPEN |
| housekeeping.e2e.ts — housekeeping dashboard totals and board are scoped to assigned open tasks, with pagination and filters | Business/fixture precondition requires investigation; not classified as harmless selector failure | OPEN |
| housekeeping.e2e.ts — my tasks supports TODO, IN_PROGRESS, DONE, pagination and completedAt detail | Selector/flow assertion no longer matches the current UI; requires migration and rerun | OPEN |
| housekeeping.e2e.ts — ownership 404 has no fallback fetch and unassigned/wrong-state work is refused by real API | Business/fixture precondition requires investigation; not classified as harmless selector failure | OPEN |
| housekeeping.e2e.ts — start and complete use empty bodies, prevent double-click, and read CLEANING/CLEAN from backend | Business/fixture precondition requires investigation; not classified as harmless selector failure | OPEN |
| housekeeping.e2e.ts — real start/complete races return 409 and refresh the visible task state | Business/fixture precondition requires investigation; not classified as harmless selector failure | OPEN |
| housekeeping.e2e.ts — reception creates a task, prevents duplicates and assigns only active HOUSEKEEPING via UUID form | Business/fixture precondition requires investigation; not classified as harmless selector failure | OPEN |
| housekeeping.e2e.ts — a concurrent task creation gets 409 without duplicate history | Business/fixture precondition requires investigation; not classified as harmless selector failure | OPEN |
| housekeeping.e2e.ts — admin board and assignment work, while a started task refuses reassignment | Business/fixture precondition requires investigation; not classified as harmless selector failure | OPEN |
| housekeeping.e2e.ts — checkout-generated TODO is visible on staff board and can be assigned without creating another task | Fixture: shared guest/IP hold quota reached during setup; downstream business steps were not executed | OPEN |
| housekeeping.e2e.ts — empty, loading, offline recovery and responsive board/task detail use real data | Selector/flow assertion no longer matches the current UI; requires migration and rerun | OPEN |
| housekeeping.e2e.ts — housekeeping authenticated 401 clears the memory session | Business/fixture precondition requires investigation; not classified as harmless selector failure | OPEN |
| kamra.e2e.ts — Kamra Today and read-only multiday calendar use real API data at desktop and tablet widths | Business/fixture precondition requires investigation; not classified as harmless selector failure | OPEN |
| reception.e2e.ts — reception dashboard totals, booking filters, pagination, detail, double-click confirm and cancel | Fixture: shared guest/IP hold quota reached during setup; downstream business steps were not executed | OPEN |
| reception.e2e.ts — booking detail returns to the filtered reception list | Business/fixture precondition requires investigation; not classified as harmless selector failure | OPEN |
| reception.e2e.ts — invalid check-in is a real PostgreSQL 409 with actionable room/date conditions | Fixture: shared guest/IP hold quota reached during setup; downstream business steps were not executed | OPEN |
| reception.e2e.ts — full front desk stay: confirm, check-in, services, invoice, CASH + BANK_TRANSFER, paid check-out triggers | Fixture: shared guest/IP hold quota reached during setup; downstream business steps were not executed | OPEN |
| reception.e2e.ts — offline payment keeps UUID across reload and retries same payload; server replay creates no duplicate | Fixture: shared guest/IP hold quota reached during setup; downstream business steps were not executed | OPEN |
| reception.e2e.ts — lost response after real committed payment is reconciled from invoice without another POST | Fixture: shared guest/IP hold quota reached during setup; downstream business steps were not executed | OPEN |
| reception.e2e.ts — admin has the same supported desk actions, 404 and responsive dashboard | Fixture: shared guest/IP hold quota reached during setup; downstream business steps were not executed | OPEN |
| reception.e2e.ts — concurrent service completion and new pending order prevent stale staff mutations | Fixture: shared guest/IP hold quota reached during setup; downstream business steps were not executed | OPEN |
| release.e2e.ts — Phase 9 continuous 18-step UI workflow with real REST/PostgreSQL and stored XSS text | Business/fixture precondition requires investigation; not classified as harmless selector failure | OPEN |

Chi tiết lỗi và trace path: [fix-playwright-triage.json](evidence/fix-playwright-triage.json). Bộ cũ còn 29 ca OPEN ngoài nhóm auth. Chúng cần được chuyển sang quy trình UI hiện tại và/hoặc fixture phù hợp, không được skip hay đánh dấu PASS.
