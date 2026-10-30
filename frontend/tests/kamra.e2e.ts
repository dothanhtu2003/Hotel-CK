import { test, expect } from "@playwright/test";
import { fixtures, login } from "./fixtures";

test("Kamra Today and read-only multiday calendar use real API data at desktop and tablet widths", async ({
  page,
  request,
}) => {
  await login(page, "reception");
  await expect(
    page.getByRole("heading", { name: "Tổng quan lễ tân" }),
  ).toBeVisible();
  await expect(page.locator(".today-metric")).toHaveCount(0);
  await expect(page.locator(".today-room").first()).toBeVisible();
  if (await page.getByRole("button", { name: "Đóng thông báo" }).isVisible())
    await page.getByRole("button", { name: "Đóng thông báo" }).click();
  await page.screenshot({
    path: "../.local/kamra-today-desktop.png",
    fullPage: true,
  });
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 950 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.screenshot({
    path: "../.local/kamra-today-tablet.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .locator(".workspace-sidebar")
    .getByRole("link", { name: "Tape Chart", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Tape Chart", exact: true }),
  ).toBeVisible();
  const f = fixtures();
  const room = await (
    await request.get("http://127.0.0.1:3301/api/rooms/" + f.deskRooms[6].id)
  ).json();
  await page.getByLabel("Loại phòng trên lịch").selectOption(room.roomType.id);
  await page.getByLabel("Ngày bắt đầu lịch").fill("2041-01-01");
  const bar = page.locator(".tape-bar").first();
  await expect(bar).toBeVisible();
  const size = await bar.evaluate((el) => ({
    bar: el.getBoundingClientRect().width,
    lane: el.parentElement!.getBoundingClientRect().width,
  }));
  expect(size.bar / size.lane).toBeCloseTo(2 / 14, 2);
  await page.screenshot({
    path: "../.local/kamra-tape-desktop.png",
    fullPage: true,
  });
  await bar.click();
  await expect(page.locator("[data-booking-id]")).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Dịch vụ", exact: true }),
  ).toBeVisible();
});
