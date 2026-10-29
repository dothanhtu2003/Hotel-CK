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
  await waitFor(() => expect(screen.getByText("Test guest")).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
  expect(screen.getByRole("alert").textContent).toContain("CLEAN");
  expect(
    (screen.getByRole("button", { name: "Tiếp tục" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(
    request.mock.calls.every(
      ([, options]) => !options?.method || options.method === "GET",
    ),
  ).toBe(true);
});
