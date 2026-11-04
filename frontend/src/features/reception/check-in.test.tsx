import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { ToastContext } from "../../components/toast-context";
import { api } from "../../lib/api";
import { CheckInWizard } from "./check-in";
import { hotelToday, shiftDate } from "./room-state";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("blocks a dirty assigned room and never submits check-in", async () => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  const request = vi
    .spyOn(api, "request")
    .mockResolvedValue({
      id: "booking",
      reference: "CK-TEST",
      status: "CONFIRMED",
      checkIn: hotelToday(),
      checkOut: shiftDate(hotelToday(), 2),
      nights: 2,
      guestCount: 1,
      roomNumber: "101",
      room: {
        operationalStatus: "ACTIVE",
        housekeepingStatus: "DIRTY",
        roomType: { name: "Standard" },
      },
      openTaskCount: 1,
      customer: { fullName: "Test guest", email: "guest@example.com" },
    });
  render(
    <MemoryRouter>
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <ToastContext.Provider value={vi.fn()}>
          <CheckInWizard bookingId="booking" />
        </ToastContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Nhận phòng" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("chưa dọn xong"));
  expect(
    request.mock.calls.every(
      ([, options]) => !options?.method || options.method === "GET",
    ),
  ).toBe(true);
});

it.each(['PENDING', 'CONFIRMED'])('checks in a %s ready room with one click', async (status) => {
  const request = vi.spyOn(api, 'request').mockResolvedValue({
    status, checkIn: hotelToday(), checkOut: shiftDate(hotelToday(), 1),
    roomNumber: '101', openTaskCount: 0,
    room: { operationalStatus: 'ACTIVE', housekeepingStatus: 'CLEAN' },
  });
  const toast = vi.fn();
  render(<MemoryRouter><QueryClientProvider client={new QueryClient()}><ToastContext.Provider value={toast}><CheckInWizard bookingId="booking" /></ToastContext.Provider></QueryClientProvider></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Nhận phòng' }));
  await waitFor(() => expect(request).toHaveBeenCalledWith('/bookings/booking/check-in', { method: 'PATCH' }));
  await waitFor(() => expect(toast).toHaveBeenCalledWith('Nhận phòng thành công.'));
  expect(screen.queryByRole('dialog')).toBeNull();
});

it.each([
  { start: 2, end: 4, label: 'Chưa đến ngày nhận phòng' },
  { start: -3, end: -1, label: 'Đã qua ngày trả phòng' },
])('disables check-in outside the stay window: $label', ({start, end, label}) => {
  const request = vi.spyOn(api, 'request');
  render(<MemoryRouter><QueryClientProvider client={new QueryClient()}><ToastContext.Provider value={vi.fn()}><CheckInWizard bookingId="booking" checkIn={shiftDate(hotelToday(), start)} checkOut={shiftDate(hotelToday(), end)} /></ToastContext.Provider></QueryClientProvider></MemoryRouter>);
  const button = screen.getByRole('button', {name: label}) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.click(button);
  expect(request).not.toHaveBeenCalled();
});
