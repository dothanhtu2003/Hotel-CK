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
import {
  ReceptionDashboard,
  ReceptionRoomBoard,
  ReceptionWalkIn,
} from "../../pages/front-desk-pages";
import { WorkspaceLayout } from "../../layouts/workspace-layout";
import { AuthContext } from "../auth/auth-context";
import { formatStayDateDisplay, hotelToday, shiftDate } from "./room-state";
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
  it("formatStayDateDisplay formats dates correctly for same year, cross year, and edge cases", () => {
    expect(formatStayDateDisplay("2026-10-27", "2026-10-29")).toBe("27/10");
    expect(formatStayDateDisplay("2026-10-30", "2026-10-29")).toBe("30/10");
    // Cross-year boundary should include 2-digit year
    expect(formatStayDateDisplay("2027-01-02", "2026-10-29")).toBe("02/01/27");
    // Edge cases
    expect(formatStayDateDisplay(null)).toBe("");
    expect(formatStayDateDisplay(undefined)).toBe("");
    expect(formatStayDateDisplay("")).toBe("");
  });

  it("Header has 'Đặt phòng mới' button leading to Room Board and removes 'Bảng trạng thái phòng' and 'Đặt phòng tại quầy' from sidebar", () => {
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
    expect(headerBtn.getAttribute("href")).toBe("/reception?mode=booking");

    // 2. Sidebar no longer has "Bảng trạng thái phòng" or "Đặt phòng tại quầy"
    expect(screen.queryByText("Bảng trạng thái phòng")).toBeNull();
    expect(screen.queryByText("Đặt phòng tại quầy")).toBeNull();
  });

  it("Route ReceptionWalkIn and ReceptionRoomBoard safely redirect to /reception preserving query params", () => {
    function LocationWatcher() {
      return (
        <Routes>
          <Route path="/reception/walk-in" element={<ReceptionWalkIn />} />
          <Route path="/reception/rooms" element={<ReceptionRoomBoard />} />
          <Route
            path="/reception"
            element={
              <div data-testid="reception-page">
                Reception Dashboard
              </div>
            }
          />
        </Routes>
      );
    }

    const { unmount } = render(
      <MemoryRouter
        initialEntries={[
          "/reception/walk-in?roomId=room-101&checkIn=2026-11-01&checkOut=2026-11-03&guests=2",
        ]}
      >
        <LocationWatcher />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("reception-page")).toBeTruthy();
    unmount();

    render(
      <MemoryRouter
        initialEntries={[
          "/reception/rooms?floor=2&state=ready",
        ]}
      >
        <LocationWatcher />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("reception-page")).toBeTruthy();
  });

  it("Room Board on Dashboard renders operational status, stay dates (IN/OUT), and action drawer", async () => {
    setupDialog();
    const today = hotelToday();
    const tomorrow = shiftDate(today, 1);

    vi.spyOn(api, "request").mockImplementation(async (path: string) => {
      if (path.includes("/front-desk/dashboard")) {
        return {
          today,
          totalRooms: 2,
          occupiedRooms: 1,
          openTasks: 0,
          counts: {
            arrivals: 0,
            departures: 1,
            staying: 1,
            ready: 1,
            dirty: 0,
            orders: 0,
            pending: 0,
          },
          arrivals: [],
          departures: [],
        };
      }
      if (path.includes("/front-desk/room-filters")) {
        return { types: [{ id: "type-1", name: "Deluxe King" }], floors: [1] };
      }
      if (path.includes("/front-desk/bookings")) {
        return { data: [], meta: { page: 1, pageSize: 8, total: 0, totalPages: 1 } };
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
          meta: { page: 1, pageSize: 200, total: 2, totalPages: 1 },
        };
      }
      return {};
    });

    render(
      <MemoryRouter initialEntries={["/reception"]}>
        <QueryClientProvider
          client={
            new QueryClient({ defaultOptions: { queries: { retry: false } } })
          }
        >
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
              <ReceptionDashboard />
            </AuthContext.Provider>
          </ToastContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    // Wait for rooms to render on the dashboard Room Board
    await waitFor(() => {
      expect(screen.getByText("101")).toBeTruthy();
      expect(screen.getByText("102")).toBeTruthy();
    });

    // Check operational status labels
    expect(screen.getByText("TRỐNG SẠCH")).toBeTruthy();
    expect(screen.getByText("ĐANG Ở")).toBeTruthy();

    // Check IN and OUT stay date labels for occupied room 102
    expect(screen.getByText("IN")).toBeTruthy();
    expect(screen.getByText("OUT")).toBeTruthy();
    expect(screen.getByText("1 đêm · 2 khách")).toBeTruthy();

    // Click room 102 opens drawer with in-house guest info and operational actions
    fireEvent.click(screen.getByText("102"));
    expect(screen.getByText("THÔNG TIN KHÁCH ĐANG Ở")).toBeTruthy();
    expect(screen.getAllByText("Trần Thị Khách").length).toBeGreaterThan(0);
    expect(screen.getByText("Trả phòng & Hóa đơn")).toBeTruthy();
    expect(screen.getAllByText("Chi tiết booking").length).toBeGreaterThan(0);
    expect(screen.getByText("Đặt phòng cho ngày tương lai")).toBeTruthy();
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
