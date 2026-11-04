import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { api } from "../../lib/api";
import { ToastContext } from "../../components/toast-context";
import { ReceptionBillingPage } from "../../pages/reception-billing-pages";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function setup(pendingOrderCount: number, paid = false, orders: unknown[] = []) {
  const booking = { id: "b1", reference: "BK-001", status: "CHECKED_IN", roomNumber: "201", nights: 4, checkIn: "2026-10-26", checkOut: "2026-10-30", customer: { fullName: "Ngô Kim Chi" } };
  vi.spyOn(api, "request").mockImplementation(async path => {
    if (path.endsWith("/invoice")) return paid ? { id: "i1", bookingId: "b1", booking, status: "PAID", roomAmount: "4000000", serviceAmount: "210000", totalAmount: "4210000", paidAmount: "4210000", balance: "0.00", payments: [] } : null;
    if (path.endsWith("/billing-preview")) return { booking, roomAmount: "4000000", serviceAmount: "210000", totalAmount: "4210000", pendingOrderCount, completedOrders: [] };
    if (path.includes("/orders?")) return { data: orders, meta: { total: orders.length, page: 1, pageSize: 10, totalPages: 1 } };
    return booking;
  });
  render(<MemoryRouter initialEntries={["/reception/bookings/b1/billing"]}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ToastContext.Provider value={vi.fn()}><Routes><Route path="/reception/bookings/:id/billing" element={<ReceptionBillingPage />} /></Routes></ToastContext.Provider></QueryClientProvider></MemoryRouter>);
}
describe("Billing workspace next action", () => {
  it("shows cash orders awaiting collection after the room invoice is paid", async () => {
    setup(1, true, [{ id: 'transfer-1', status: 'PENDING', requestedPaymentMethod: 'CASH', paymentMethod: null, payosStatus: null, totalAmount: '9000', items: [{ id: 'item-1', serviceName: 'Nước uống', quantity: 1, unitPrice: '9000', subtotal: '9000' }] }]);
    expect(await screen.findByText('Nước uống')).toBeTruthy();
    expect(screen.getByText('Chờ thanh toán')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nhận tiền và hoàn tất' })).toBeTruthy();
    expect(api.request).toHaveBeenCalledWith(expect.stringContaining('bookingId=b1&view=checkout'), expect.any(Object));
    expect(screen.queryByRole('button', { name: 'Xác nhận trả phòng' })).toBeNull();
  });
  it("shows the issue action beside the amount when services are ready", async () => {
    setup(0);
    expect(await screen.findByRole("button", { name: "Phát hành hóa đơn" })).toBeTruthy();
    expect(screen.getByText("Đang lưu trú")).toBeTruthy();
    expect(screen.getByText("26/10/2026 → 30/10/2026 · 4 đêm")).toBeTruthy();
    expect(screen.queryByText("Bước 1")).toBeNull();
    expect(screen.queryByRole("button", { name: "Xác nhận trả phòng" })).toBeNull();
  });
  it("blocks issue when services are pending", async () => {
    setup(1);
    expect(await screen.findByText("Cần xử lý 1 đơn dịch vụ")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Phát hành hóa đơn" })).toBeNull();
  });
  it("offers checkout after the invoice is paid in full", async () => {
    setup(0, true);
    expect(await screen.findByRole("button", { name: "Xác nhận trả phòng" })).toBeTruthy();
    expect(screen.getByText("Đã thanh toán đủ.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Phát hành hóa đơn" })).toBeNull();
  });
});
