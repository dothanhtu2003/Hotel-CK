import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastContext } from "../../components/toast-context";
import { BookingTable } from "./components";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("BookingTable UX improvements", () => {
  const rows = [
    {
      id: "b-test-1",
      reference: "CK-REF001",
      userId: "u1",
      roomId: "r1",
      status: "CONFIRMED" as const,
      checkIn: "2026-10-30",
      checkOut: "2026-11-02",
      nights: 3,
      guestCount: 2,
      nightlyPrice: "1000000.00",
      totalRoomAmount: "3000000.00",
      roomNumber: "309",
      customer: {
        id: "u1",
        fullName: "Phạm Thanh Hà",
        phone: "0901234567",
        email: "ha@example.com",
      },
    },
  ];

  it("does not render the 'Chi tiết' button in THAO TÁC", () => {
    render(
      <MemoryRouter initialEntries={["/reception/bookings"]}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <ToastContext.Provider value={() => {}}>
            <BookingTable rows={rows} />
          </ToastContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: "Chi tiết" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Chi tiết" })).toBeNull();
  });

  it("renders the customer name as a clickable link navigating to booking detail", () => {
    render(
      <MemoryRouter initialEntries={["/reception/bookings"]}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <ToastContext.Provider value={() => {}}>
            <BookingTable rows={rows} />
          </ToastContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    const nameLink = screen.getByRole("link", { name: "Phạm Thanh Hà" });
    expect(nameLink).toBeTruthy();
    expect(nameLink.getAttribute("href")).toBe("/reception/bookings/b-test-1");
  });

  it("navigates to booking detail when clicking anywhere on the row", async () => {
    function PathTracker() {
      const loc = useLocation();
      return <div data-testid="path">{loc.pathname}</div>;
    }

    render(
      <MemoryRouter initialEntries={["/reception/bookings"]}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <ToastContext.Provider value={() => {}}>
            <PathTracker />
            <BookingTable rows={rows} />
          </ToastContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    // Clicking room number cell
    fireEvent.click(screen.getByText("Phòng 309"));
    await waitFor(() => {
      expect(screen.getByTestId("path").textContent).toBe("/reception/bookings/b-test-1");
    });
  });

  it("does not trigger row navigation when clicking action buttons inside THAO TÁC", async () => {
    function PathTracker() {
      const loc = useLocation();
      return <div data-testid="path">{loc.pathname}</div>;
    }

    render(
      <MemoryRouter initialEntries={["/reception/bookings"]}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <ToastContext.Provider value={() => {}}>
            <PathTracker />
            <BookingTable rows={rows} />
          </ToastContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    // Click on "Nhận phòng" action button
    const checkInBtn = screen.getByRole("button", { name: "Nhận phòng" });
    fireEvent.click(checkInBtn);

    // Path should remain /reception/bookings because stopPropagation prevented row click
    expect(screen.getByTestId("path").textContent).toBe("/reception/bookings");
  });
});
