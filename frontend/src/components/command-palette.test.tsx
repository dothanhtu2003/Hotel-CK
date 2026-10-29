import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { CommandPalette } from "./command-palette";
import { api } from "../lib/api";

afterEach(cleanup);

describe("CommandPalette global search component", () => {
  it("renders shortcuts when empty and handles Escape key", () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <CommandPalette open={true} onClose={onClose} home="/reception" />
      </MemoryRouter>,
    );

    expect(
      screen.getByPlaceholderText("Tìm khách, mã booking, số phòng, số điện thoại…"),
    ).toBeTruthy();
    expect(screen.getByText("Đặt phòng mới")).toBeTruthy();
    expect(screen.getByText("Sơ đồ timeline Tape Chart")).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("dispatches server-side searches for bookings and rooms with q parameter", async () => {
    const onClose = vi.fn();
    const requestSpy = vi.spyOn(api, "request").mockImplementation(async (path: string) => {
      if (path.includes("/front-desk/bookings")) {
        return {
          data: [
            {
              id: "b1",
              reference: "CK-12345",
              status: "CONFIRMED",
              roomNumber: "101",
              checkIn: "2026-10-29",
              checkOut: "2026-10-31",
              nights: 2,
              guestCount: 2,
              nightlyPrice: "500000.00",
              totalRoomAmount: "1000000.00",
              userId: "u1",
              customer: { id: "u1", fullName: "Nguyễn Văn A", email: "a@example.com", phone: "0901234567" },
              createdAt: "2026-10-28T00:00:00Z",
              updatedAt: "2026-10-28T00:00:00Z",
            },
          ],
          meta: { page: 1, pageSize: 5, total: 1, totalPages: 1 },
        } as never;
      }
      if (path.includes("/front-desk/rooms")) {
        return {
          data: [
            {
              id: "r1",
              roomNumber: "101",
              floor: 1,
              operationalStatus: "ACTIVE",
              housekeepingStatus: "CLEAN",
              roomTypeId: "t1",
              roomType: { id: "t1", name: "Deluxe King", nightlyPrice: "500000.00", maxGuests: 2 },
              bookings: [],
              openTaskCount: 0,
            },
          ],
          meta: { page: 1, pageSize: 5, total: 1, totalPages: 1 },
        } as never;
      }
      return { data: [], meta: { page: 1, pageSize: 5, total: 0, totalPages: 0 } } as never;
    });

    render(
      <MemoryRouter>
        <CommandPalette open={true} onClose={onClose} home="/reception" />
      </MemoryRouter>,
    );

    const input = screen.getByPlaceholderText("Tìm khách, mã booking, số phòng, số điện thoại…");
    fireEvent.change(input, { target: { value: "101" } });

    await waitFor(() => {
      expect(screen.getByText("Nguyễn Văn A")).toBeTruthy();
      expect(screen.getByText(/Phòng 101 \(Deluxe King\)/)).toBeTruthy();
    });

    expect(requestSpy).toHaveBeenCalledWith(
      expect.stringContaining("/front-desk/rooms?q=101&pageSize=5"),
      expect.anything(),
    );
    expect(requestSpy).toHaveBeenCalledWith(
      expect.stringContaining("/front-desk/bookings?q=101&pageSize=5"),
      expect.anything(),
    );

    requestSpy.mockRestore();
  });
});
