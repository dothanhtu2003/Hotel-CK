import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { api } from "../../lib/api";
import { CashierPage } from "./cashier";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("Cashier page", () => {
  it("defaults to departures, filters on the server and opens the invoice preparation drawer", async () => {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
    const calls: string[] = [];
    vi.spyOn(api, "request").mockImplementation(async path => {
      calls.push(path);
      if (path.endsWith("/invoice")) return null;
      return { data: [{ id: "booking-1", customer: { fullName: "Nguyễn Thu" }, reference: "BK-001", roomNumber: "101", status: "CHECKED_IN", checkOut: "2026-10-30", roomAmount: "1000000", serviceAmount: "200000", totalAmount: "1200000", paidAmount: "0", balance: "1200000", invoiceId: null, pendingOrderCount: 0, paymentState: "OUTSTANDING" }], meta: { page: 1, pageSize: 15, total: 1, totalPages: 1 }, counts: { departures: 1, outstanding: 1, paid: 0, all: 1 } };
    });
    render(<MemoryRouter initialEntries={["/reception/billing"]}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><CashierPage /></QueryClientProvider></MemoryRouter>);
    expect(await screen.findByText("Nguyễn Thu")).toBeTruthy();
    expect(calls[0]).toContain("group=departures");
    expect(screen.getByRole("columnheader", { name: "CÒN PHẢI THU" })).toBeTruthy();
    expect(screen.queryByText("Khách đến (Arrivals)")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Còn phải thu/ }));
    await screen.findByRole("button", { name: /^Còn phải thu/, pressed: true });
    fireEvent.click(await screen.findByRole("button", { name: "Chi tiết" }));
    expect(await screen.findByRole("dialog", { name: "Chi tiết chi phí và thanh toán" })).toBeTruthy();
    expect(await screen.findByRole("link", { name: "Mở chi phí & phát hành hóa đơn" })).toHaveProperty("pathname", "/reception/bookings/booking-1/billing");
  });
});
