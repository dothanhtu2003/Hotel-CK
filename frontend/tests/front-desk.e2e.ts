import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { fixtures, login } from "./fixtures";
const api = "http://127.0.0.1:3301/api";
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
async function findRoom(page: Page, index: number) {
  await page
    .locator(".workspace-sidebar")
    .getByRole("link", { name: "Đặt phòng tại quầy", exact: true })
    .click();
  const start = today(),
    end = new Date(Date.parse(start + "T00:00:00Z") + 86400000 * 2)
      .toISOString()
      .slice(0, 10);
  await page.getByLabel("Ngày nhận phòng", { exact: true }).fill(start);
  await page.getByLabel("Ngày trả phòng", { exact: true }).fill(end);
  await page
    .getByRole("button", { name: "Tìm phòng khả dụng", exact: true })
    .click();
  await page
    .locator(".desk-room")
    .filter({ hasText: fixtures().deskRooms[index].roomNumber })
    .click();
}
async function confirm(page: Page) {
  await page
    .getByRole("button", { name: "Xem lại booking", exact: true })
    .click();
  const response = page.waitForResponse(
    (r) =>
      r.url() === api + "/front-desk/walk-in" &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Xác nhận tạo booking", exact: true })
    .click({ clickCount: 2 });
  const r = await response;
  expect(r.status()).toBe(201);
  const b = await r.json();
  await expect(page).toHaveURL("/reception/bookings/" + b.id);
  return b;
}
test("walk-in links an existing guest, shows quote, creates once, confirms and checks in", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page, "reception");
  await findRoom(page, 7);
  await page
    .getByLabel("Tìm theo tên, điện thoại hoặc email")
    .fill(fixtures().users.guest.email);
  await page
    .getByRole("button", { name: "Tìm khách hàng", exact: true })
    .click();
  await page
    .locator(".desk-customers button")
    .filter({ hasText: fixtures().users.guest.email })
    .click();
  await expect(page.locator(".desk-total")).toContainText("1.300.000,50 ₫");
  let writes = 0;
  page.on("request", (r) => {
    if (r.url() === api + "/front-desk/walk-in" && r.method() === "POST")
      writes++;
  });
  const b = await confirm(page);
  expect(b.userId).toBe(fixtures().users.guest.id);
  expect(writes).toBe(1);
  await expect(page.locator(".guest-facts").first()).toContainText(
    fixtures().users.guest.email,
  );
  for (const label of ["Xác nhận booking", "Nhận phòng"]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    if (label === "Nhận phòng") for (let i=0;i<2;i++) await page.getByRole("dialog").getByRole("button", { name: "Tiếp tục" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", {
        name: "Xác nhận " + label.toLocaleLowerCase("vi-VN"),
        exact: true,
      })
      .click();
  }
  await expect(page.locator(".desk-page .status-badge")).toHaveText(
    "Đang lưu trú",
  );
  await page
    .locator(".workspace-sidebar")
    .getByRole("link", { name: "Bảng trạng thái phòng", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Trạng thái", exact: true })
    .selectOption("occupied");
  await page
    .getByRole("combobox", { name: "Loại phòng", exact: true })
    .selectOption(
      fixtures().deskRooms[7]
        ? (
            await (
              await request.get(api + "/rooms/" + fixtures().deskRooms[7].id)
            ).json()
          ).roomType.id
        : "",
    );
  const card = page
    .locator(".desk-room")
    .filter({ hasText: fixtures().deskRooms[7].roomNumber });
  await expect(card).toContainText(b.customer.fullName);
  await card.click();
  await expect(page.getByRole("dialog")).toContainText(b.reference);
  await page.keyboard.press("Escape");
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 950 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await expect(page.locator(".toast")).toHaveCount(0, { timeout: 10000 });
  await page.screenshot({
    path: "../.local/front-desk-board-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .locator(".workspace-sidebar")
    .getByRole("link", { name: "Hôm nay", exact: true })
    .click();
  await expect(page.locator(".today-metrics>a")).toHaveCount(6);
  await page.screenshot({
    path: "../.local/front-desk-dashboard.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("walk-in creates a real customer profile and server search finds its booking", async ({
  page,
}) => {
  await login(page, "reception");
  await findRoom(page, 8);
  await page
    .getByRole("button", { name: "Tạo hồ sơ mới", exact: true })
    .click();
  const name = "Khách tại quầy " + randomUUID().slice(0, 8),
    email = randomUUID() + "@frontend-test.invalid";
  await page.getByLabel("Họ và tên", { exact: true }).fill(name);
  await page.getByLabel("Email", { exact: true }).fill("");
  await page.getByLabel("Số điện thoại", { exact: true }).fill("0901234567");
  await page.getByRole("button", { name: "Xem lại booking", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(await page.getByLabel("Email", { exact: true }).evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Số điện thoại", { exact: true })
    .fill("09" + Date.now().toString().slice(-8));
  await page.screenshot({ path: "../.local/kamra-walkin-desktop.png", fullPage: true });
  const b = await confirm(page);
  expect(b.customer.fullName).toBe(name);
  expect(b).not.toHaveProperty("accessToken");
  await expect(page.locator(".guest-facts").first()).toContainText(email);
  await page
    .locator(".workspace-sidebar")
    .getByRole("link", { name: "Quản lý booking", exact: true })
    .click();
  await page.getByLabel("Tìm nhanh booking").fill(email);
  await page.getByRole("button", { name: "Tìm booking", exact: true }).click();
  await expect(page.getByLabel("Tìm booking hoặc khách")).toHaveValue(email);
  await page.getByLabel("Tìm booking hoặc khách").fill(email);
  await page.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText(b.reference);
  await expect(page.locator("tbody")).toContainText(name);
  await page
    .getByLabel("Tìm booking hoặc khách")
    .fill("no-result-" + randomUUID());
  await page.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Chưa có booking phù hợp" }),
  ).toBeVisible();
});

test("walk-in reports an existing profile and dirty-room check-in is rejected without changing the booking", async ({
  page,
  request,
}) => {
  await login(page, "reception");
  await findRoom(page, 9);
  await page
    .getByRole("button", { name: "Tạo hồ sơ mới", exact: true })
    .click();
  await page.getByLabel("Họ và tên", { exact: true }).fill("Existing customer");
  await page
    .getByLabel("Email", { exact: true })
    .fill(fixtures().users.guest.email);
  await page
    .getByLabel("Số điện thoại", { exact: true })
    .fill("09" + Date.now().toString().slice(-8));
  await page
    .getByRole("button", { name: "Xem lại booking", exact: true })
    .click();
  const duplicate = page.waitForResponse(
    (r) =>
      r.url() === api + "/front-desk/walk-in" &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Xác nhận tạo booking", exact: true })
    .click();
  expect((await duplicate).status()).toBe(409);
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Khách đã có hồ sơ",
  );
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Xác nhận tạo booking", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Đóng hộp thoại" })
    .click();
  await page
    .getByRole("button", { name: "Tìm khách đã có", exact: true })
    .click();
  await page
    .getByLabel("Tìm theo tên, điện thoại hoặc email")
    .fill(fixtures().users.guest.email);
  await page
    .getByRole("button", { name: "Tìm khách hàng", exact: true })
    .click();
  await page
    .locator(".desk-customers button")
    .filter({ hasText: fixtures().users.guest.email })
    .click();
  const b = await confirm(page);
  await page
    .getByRole("button", { name: "Xác nhận booking", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Xác nhận xác nhận booking", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Nhận phòng", exact: true }),
  ).toBeVisible();
  const authResponse = await request.post(api + "/auth/login", {
    data: {
      email: fixtures().users.reception.email,
      password: fixtures().password,
    },
  });
  expect(authResponse.status()).toBe(200);
  const headers = {
    Authorization: "Bearer " + (await authResponse.json()).accessToken,
  };
  expect(
    (
      await request.post(api + "/housekeeping/tasks", {
        headers,
        data: {
          roomId: fixtures().deskRooms[9].id,
          notes: "Dirty room check-in test",
        },
      })
    ).status(),
  ).toBe(201);
  await page
    .locator(".workspace-sidebar")
    .getByRole("link", { name: "Quản lý booking", exact: true })
    .click();
  await page.getByRole("link", { name: b.reference, exact: true }).click();
  await expect(
    page.getByText(/Phòng: Đang hoạt động.*Chưa sạch/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Nhận phòng", exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Tiếp tục' }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Tiếp tục' })).toBeDisabled();
  expect((await request.patch(api + `/bookings/${b.id}/check-in`, { headers })).status()).toBe(409);
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "CLEAN",
  );
  const current = await request.get(api + "/bookings/" + b.id, { headers });
  expect((await current.json()).status).toBe("CONFIRMED");
});
