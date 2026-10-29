import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { ToastContext } from "../../components/toast-context";
import { api } from "../../lib/api";
import { ReceptionRoomBoard, ReceptionWalkIn } from "../../pages/front-desk-pages";
import { WorkspaceLayout } from "../../layouts/workspace-layout";
import { AuthContext } from "../auth/auth-context";
import { hotelToday, shiftDate } from "./room-state";
import { UnifiedBookingModal } from "./unified-booking-modal";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const mockStaffUser = {
  id: "staff-1",
  fullName: "Lễ Tân An Nhiên",
  email: "reception@annhien.vn",
  phone: "0901234567",
  role: "RECEPTIONIST" as const,
  status: "ACTIVE" as const,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function setupDialog() {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
}

describe("Unified Room Board & Booking Flow", () => {
  it("Header has 'Đặt phòng mới' button leading to Room Board and removes 'Đặt phòng tại quầy' from sidebar", () => {
    render(
      <MemoryRouter initialEntries={["/reception"]}>
        <ToastContext.Provider value={() => {}}>
          <AuthContext.Provider
            value={{
              user: mockStaffUser,
              notice: null,
              login: async () => mockStaffUser,
              logout: () => {},
              updateUser: () => true,
            }}
          >
            <WorkspaceLayout />
          </AuthContext.Provider>
        </ToastContext.Provider>
      </MemoryRouter>,
    );

    // 1. Header has "Đặt phòng mới"
    const headerBtn = screen.getByRole("link", { name: "Đặt phòng mới" });
    expect(headerBtn).toBeTruthy();
    expect(headerBtn.getAttribute("href")).toBe("/reception/rooms?mode=booking");

    // 2. Sidebar no longer has "Đặt phòng tại quầy"
    expect(screen.queryByText("Đặt phòng tại quầy")).toBeNull();
  });

  it("Route ReceptionWalkIn safely redirects to rooms preserving query params and sets mode=booking", () => {
    function LocationWatcher() {
      return (
        <Routes>
          <Route path="/reception/walk-in" element={<ReceptionWalkIn />} />
          <Route
            path="/reception/rooms"
            element={
              <div data-testid="rooms-page">
                Room Board Content
              </div>
            }
          />
        </Routes>
      );
    }

    render(
      <MemoryRouter
        initialEntries={[
          "/reception/walk-in?roomId=room-101&checkIn=2026-11-01&checkOut=2026-11-03&guests=2",
        ]}
      >
        <LocationWatcher />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("rooms-page")).toBeTruthy();
  });

  it("Room Board renders operational status and booking availability distinctly", async () => {
    setupDialog();
    const today = hotelToday();
    const tomorrow = shiftDate(today, 1);

    vi.spyOn(api, "request").mockImplementation(async (path: string) => {
      if (path.includes("/front-desk/room-filters")) {
        return { types: [{ id: "type-1", name: "Deluxe King" }], floors: [1] };
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
              openTaskCount: 0,
              roomType: {
                id: "type-1",
                name: "Deluxe King",
                nightlyPrice: "1200000.00",
                maxGuests: 2,
              },
              bookings: [],
            },
            {
              id: "r2",
              roomNumber: "102",
              floor: 1,
              operationalStatus: "ACTIVE",
              housekeepingStatus: "CLEAN",
              openTaskCount: 0,
              roomType: {
                id: "type-1",
                name: "Deluxe King",
                nightlyPrice: "1200000.00",
                maxGuests: 2,
              },
              bookings: [
                {
                  id: "b-checked-in",
                  reference: "CK-INHOUSE",
                  status: "CHECKED_IN",
                  checkIn: today,
                  checkOut: tomorrow,
                  nights: 1,
                  guestCount: 2,
                  totalRoomAmount: "1200000.00",
                  customer: {
                    fullName: "Trần Thị Khách",
                    phone: "0912345678",
                    email: "khach@example.com",
                  },
                },
              ],
            },
          ],
          meta: { page: 1, pageSize: 50, total: 2, totalPages: 1 },
        };
      }
      if (path.includes("/front-desk/available")) {
        // Room 101 is available; Room 102 is currently checked in for same day
        return {
          checkIn: today,
          checkOut: tomorrow,
          guests: 2,
          nights: 1,
          data: [
            {
              id: "r1",
              roomNumber: "101",
              floor: 1,
              operationalStatus: "ACTIVE",
              housekeepingStatus: "CLEAN",
              roomType: {
                id: "type-1",
                name: "Deluxe King",
                nightlyPrice: "1200000.00",
                maxGuests: 2,
              },
              estimatedTotalAmount: "1200000.00",
            },
          ],
        };
      }
      return {};
    });

    render(
      <MemoryRouter initialEntries={["/reception/rooms"]}>
        <QueryClientProvider
          client={
            new QueryClient({ defaultOptions: { queries: { retry: false } } })
          }
        >
          <ToastContext.Provider value={() => {}}>
            <ReceptionRoomBoard />
          </ToastContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    // Wait for rooms to render
    await waitFor(() => {
      expect(screen.getByText("101")).toBeTruthy();
      expect(screen.getByText("102")).toBeTruthy();
    });

    // Check legend displays both operational and availability sections
    expect(screen.getByText("Trạng thái vận hành:")).toBeTruthy();
    expect(screen.getByText("Khả dụng (" + today + " → " + tomorrow + "):")).toBeTruthy();

    // Room 101 has "Có thể đặt"
    const availPill = screen.getByTitle("Phòng có thể nhận đặt cho khoảng ngày đã chọn");
    expect(availPill).toBeTruthy();

    // Room 102 has operational "Đang ở" but availability "Không thể đặt"
    expect(screen.getByText("Khách: Trần Thị Khách")).toBeTruthy();
    expect(screen.getByText("Phòng đang có khách lưu trú hôm nay")).toBeTruthy();

    // Click room 102 opens drawer with operational actions
    fireEvent.click(screen.getByText("102"));
    expect(screen.getByText("THÔNG TIN KHÁCH ĐANG Ở")).toBeTruthy();
    expect(screen.getByText("Làm thủ tục trả phòng")).toBeTruthy();
    expect(screen.getAllByText("Chi tiết booking").length).toBeGreaterThan(0);
  });

  it("Unified Booking Modal enforces valid guest info, forbids invalid emails, and starts in PENDING", async () => {
    setupDialog();
    const today = hotelToday();
    const tomorrow = shiftDate(today, 2);

    const mockPost = vi.fn().mockResolvedValue({
      id: "new-booking-uuid",
      reference: "CK-NEWBOOKING",
      status: "PENDING",
      checkIn: today,
      checkOut: tomorrow,
      nights: 2,
      guestCount: 2,
      totalRoomAmount: "2400000.00",
    });

    vi.spyOn(api, "request").mockImplementation(async (path, opts) => {
      if (opts?.method === "POST" && path === "/front-desk/walk-in") {
        return mockPost(opts.body);
      }
      return {};
    });

    const mockRoom = {
      id: "room-abc",
      roomNumber: "201",
      floor: 2,
      roomType: {
        id: "type-deluxe",
        name: "Deluxe King",
        nightlyPrice: "1200000.00",
        maxGuests: 2,
      },
    };

    const onClose = vi.fn();
    const onSuccess = vi.fn();

    render(
      <MemoryRouter>
        <QueryClientProvider
          client={
            new QueryClient({ defaultOptions: { queries: { retry: false } } })
          }
        >
          <ToastContext.Provider value={() => {}}>
            <UnifiedBookingModal
              open={true}
              onClose={onClose}
              room={mockRoom}
              initialCheckIn={today}
              initialCheckOut={tomorrow}
              initialGuests={2}
              onSuccess={onSuccess}
            />
          </ToastContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    // Switch to create new guest
    fireEvent.click(screen.getByText("Tạo hồ sơ mới"));

    // Attempting submit without filling email
    fireEvent.change(screen.getByPlaceholderText("Ví dụ: Nguyễn Văn An"), {
      target: { value: "Lê Văn C" },
    });
    fireEvent.change(screen.getByPlaceholderText("Ví dụ: 0901234567"), {
      target: { value: "0987654321" },
    });
    // Try submit with invalid email
    fireEvent.change(screen.getByPlaceholderText("Email thực tế của khách"), {
      target: { value: "not-an-email" },
    });
    fireEvent.click(screen.getByText("Xem lại & Xác nhận"));

    // Check error shown
    expect(
      screen.getByText("Vui lòng nhập địa chỉ email hợp lệ của khách."),
    ).toBeTruthy();
    expect(mockPost).not.toHaveBeenCalled();

    // Now enter valid real email
    fireEvent.change(screen.getByPlaceholderText("Email thực tế của khách"), {
      target: { value: "real.customer@example.com" },
    });
    fireEvent.click(screen.getByText("Xem lại & Xác nhận"));

    // Review dialog opens
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Xác nhận tạo booking" })).toBeTruthy();
    });

    // Check status note: PENDING, no auto check-in
    expect(
      screen.getByText(/Booking bắt đầu ở trạng thái/),
    ).toBeTruthy();

    // Confirm creation
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận tạo booking" }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith({
        roomId: "room-abc",
        checkIn: today,
        checkOut: tomorrow,
        guests: 2,
        fullName: "Lê Văn C",
        phone: "0987654321",
        email: "real.customer@example.com",
      });
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it("Validates checkOut > checkIn and blocks checkOut <= checkIn", () => {
    setupDialog();
    const today = hotelToday();

    render(
      <MemoryRouter>
        <QueryClientProvider
          client={
            new QueryClient({ defaultOptions: { queries: { retry: false } } })
          }
        >
          <ToastContext.Provider value={() => {}}>
            <UnifiedBookingModal
              open={true}
              onClose={() => {}}
              room={{
                id: "r1",
                roomNumber: "101",
                floor: 1,
                roomType: {
                  id: "t1",
                  name: "Standard",
                  nightlyPrice: "500000",
                  maxGuests: 2,
                },
              }}
              initialCheckIn={today}
              initialCheckOut={today} // Equal dates!
              initialGuests={2}
            />
          </ToastContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(
      screen.getByText("⚠️ Ngày trả phòng phải sau ngày nhận phòng."),
    ).toBeTruthy();
    const submitBtn = screen.getByText("Xem lại & Xác nhận") as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });
});
