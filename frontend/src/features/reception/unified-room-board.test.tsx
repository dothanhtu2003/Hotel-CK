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
  ReceptionBookingsPage,
  ReceptionDashboard,
  ReceptionRoomBoard,
  ReceptionWalkIn,
} from "../../pages/front-desk-pages";
import { BookingTable } from "./components";
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
    this.dispatchEvent(new Event("close"));
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

    // Verify Guest Dispatch (Điều phối khách) section is completely removed from dashboard
    expect(screen.queryByText("Điều phối khách")).toBeNull();
    expect(screen.queryByText("Xem tất cả →")).toBeNull();
  });

  it.each(["real.customer@example.com", ""])("Unified Booking Modal validates optional email %s and starts in PENDING", async (guestEmail) => {
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
      target: { value: guestEmail },
    });
    fireEvent.click(screen.getByText("Xem lại & Xác nhận"));

    // Review dialog opens
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Xác nhận tạo booking" })).toBeTruthy();
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();

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
        ...(guestEmail ? { email: guestEmail } : {}),
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

  it("ReceptionBookingsPage displays 3 operational tab cards with exact counts from booking-counts API", async () => {
    vi.spyOn(api, "request").mockImplementation(async (path: string) => {
      if (path.includes("booking-counts")) {
        return { arrivals: 4, departures: 2, staying: 7 };
      }
      if (path.includes("front-desk/bookings")) {
        return {
          data: [
            {
              id: "b1",
              reference: "CK-TEST01",
              userId: "c1",
              roomId: "r1",
              status: "CONFIRMED",
              checkIn: "2026-10-29",
              checkOut: "2026-10-31",
              nights: 2,
              guestCount: 2,
              nightlyPrice: "1000000.00",
              totalRoomAmount: "2000000.00",
              roomNumber: "101",
              customer: {
                id: "c1",
                fullName: "Nguyễn Văn Test",
                phone: "0901234567",
                email: "test@example.com",
              },
            },
          ],
          meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
        };
      }
      return {};
    });

    render(
      <MemoryRouter initialEntries={["/reception/bookings"]}>
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
          <ToastContext.Provider value={() => {}}>
            <ReceptionBookingsPage />
          </ToastContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    // Verify 3 operational tab cards show exact numbers even on 'All bookings' view
    await waitFor(() => {
      const arrivalsTab = screen.getByRole("tab", { name: /Khách đến/ });
      expect(arrivalsTab.textContent).toContain("4");
      const stayingTab = screen.getByRole("tab", { name: /Đang ở/ });
      expect(stayingTab.textContent).toContain("7");
      const departuresTab = screen.getByRole("tab", { name: /Khách đi/ });
      expect(departuresTab.textContent).toContain("2");
    });

    // Check table content
    expect(screen.getByText("Nguyễn Văn Test")).toBeTruthy();
    expect(screen.getByText("CK-TEST01")).toBeTruthy();
  });

  it.each([0, 3])("dashboard removes KPIs and guest hub, preserves conditional actionable alerts (%i)", async (pending) => {
    setupDialog();
    vi.spyOn(api, "request").mockImplementation(async (path: string) => {
      if (path.includes("dashboard")) return { today: hotelToday(), counts: { pending, orders: pending }, arrivals: [], departures: [] };
      if (path.includes("room-filters")) return { floors: [1], types: [] };
      return { data: [], meta: { total: 0 } };
    });
    const { container } = render(<MemoryRouter initialEntries={["/reception"]}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AuthContext.Provider value={{ user: mockStaffUser, notice: null, login: async () => mockStaffUser, logout: async () => {}, updateUser: () => true }}>
          <ToastContext.Provider value={() => {}}><ReceptionDashboard /></ToastContext.Provider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Bảng trạng thái phòng (Room Board)")).toBeTruthy());
    expect(container.querySelector(".today-metrics")).toBeNull();
    expect(screen.queryByText("Điều phối khách")).toBeNull();
    if (pending) {
      expect(screen.getByText("3 booking chờ xác nhận").closest("a")?.getAttribute("href")).toBe("/reception/bookings?status=PENDING");
      expect(screen.getByText("3 đơn dịch vụ phòng chờ xử lý").closest("a")?.getAttribute("href")).toBe("/reception/service-orders?status=PENDING");
    } else expect(screen.queryByText("Cần lưu ý:")).toBeNull();
  });

  it("booking totals follow date, stay independent of tabs and filters, and display zero", async () => {
    const request = vi.spyOn(api, "request").mockImplementation(async (path: string) => {
      if (path.includes("booking-counts")) return { arrivals: 0, staying: 0, departures: 0 };
      return { data: [], meta: { page: 1, pageSize: 10, total: 90, totalPages: 9 } };
    });
    render(<MemoryRouter initialEntries={["/reception/bookings?date=2026-10-29&q=test&page=2"]}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ReceptionBookingsPage />
      </QueryClientProvider>
    </MemoryRouter>);
    await waitFor(() => expect(screen.getAllByText("0 booking")).toHaveLength(3));
    fireEvent.click(screen.getByRole("tab", { name: /Đang ở/ }));
    await waitFor(() => expect(request.mock.calls.some(([path]) => path.includes("view=staying") && path.includes("q=test") && !path.includes("page=2"))).toBe(true));
    expect(screen.getAllByText("0 booking")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Ngày sau" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("/front-desk/booking-counts?date=2026-10-30", expect.anything()));
    expect(screen.getAllByText("0 booking")).toHaveLength(3);
  });

  it("booking totals show an actionable API error and recover on retry", async () => {
    let failed = true;
    vi.spyOn(api, "request").mockImplementation(async (path: string) => {
      if (path.includes("booking-counts")) {
        if (failed) throw new Error("Unavailable");
        return { arrivals: 0, staying: 0, departures: 0 };
      }
      return { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } };
    });
    render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ReceptionBookingsPage /></QueryClientProvider></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Không thể tải số liệu booking.")).toBeTruthy());
    expect(screen.getAllByText("Lỗi tải")).toHaveLength(3);
    failed = false;
    fireEvent.click(screen.getByRole("button", { name: /Thử lại/ }));
    await waitFor(() => expect(screen.getAllByText("0 booking")).toHaveLength(3));
  });

  it("BookingTable renders prominent customer name and booking reference link with fallback for missing customer", () => {
    const rows = [
      {
        id: "b-with-customer",
        reference: "CK-REF123",
        userId: "u1",
        roomId: "r1",
        status: "CONFIRMED" as const,
        checkIn: "2026-10-29",
        checkOut: "2026-10-31",
        nights: 2,
        guestCount: 2,
        nightlyPrice: "500000.00",
        totalRoomAmount: "1000000.00",
        roomNumber: "101",
        customer: {
          id: "u1",
          fullName: "Lê Hoàng Yến",
          phone: "0918765432",
          email: "yen@example.com",
        },
      },
      {
        id: "b-without-customer",
        reference: "8a4b3c2d-1111-2222-3333-444455556666",
        userId: "u2",
        roomId: "r2",
        status: "CHECKED_IN" as const,
        checkIn: "2026-10-29",
        checkOut: "2026-10-30",
        nights: 1,
        guestCount: 1,
        nightlyPrice: "800000.00",
        totalRoomAmount: "800000.00",
        roomNumber: "202",
        customer: undefined,
      },
    ];

    render(
      <MemoryRouter initialEntries={["/reception/bookings"]}>
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
          <ToastContext.Provider value={() => {}}>
            <BookingTable rows={rows} />
          </ToastContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    // Row 1: has customer name
    expect(screen.getByText("Lê Hoàng Yến")).toBeTruthy();
    const link1 = screen.getByRole("link", { name: "CK-REF123" });
    expect(link1).toBeTruthy();
    expect(link1.getAttribute("href")).toBe("/reception/bookings/b-with-customer");
    expect(screen.getByText("0918765432")).toBeTruthy();

    // Row 2: without customer name falls back to "Khách tại quầy" instead of repeating the UUID
    expect(screen.getByText("Khách tại quầy")).toBeTruthy();
    const link2 = screen.getByRole("link", {
      name: "8a4b3c2d-1111-2222-3333-444455556666",
    });
    expect(link2).toBeTruthy();
    expect(link2.getAttribute("href")).toBe(
      "/reception/bookings/b-without-customer",
    );
  });
});


it.each([['PENDING', 'CHỜ XÁC NHẬN'], ['CONFIRMED', 'ĐÃ ĐẶT']])('room board shows %s reservations instead of vacant rooms', async (status, label) => {
  setupDialog();
  const today = hotelToday();
  vi.spyOn(api, 'request').mockImplementation(async path => {
    if (path.includes('/front-desk/dashboard')) return { today, totalRooms: 1, occupiedRooms: 0, openTasks: 0, counts: { pending: 0, orders: 0, arrivals: 0, departures: 0, staying: 0, ready: 0, dirty: 0 }, arrivals: [], departures: [], staying: [] };
    if (path.includes('/front-desk/room-filters')) return { types: [], floors: [1] };
    if (path.includes('/front-desk/rooms')) return { data: [{ id: 'reserved-room', roomNumber: '111', floor: 1, operationalStatus: 'ACTIVE', housekeepingStatus: 'CLEAN', openTaskCount: 0, roomType: { id: 'type', name: 'Standard', nightlyPrice: '650000', maxGuests: 2 }, bookings: [{ id: 'reserved-booking', status, checkIn: today, checkOut: shiftDate(today, 1), customer: { fullName: 'Khách vừa đặt' } }] }], meta: { page: 1, pageSize: 200, total: 1, totalPages: 1 } };
    return { data: [], meta: { page: 1, pageSize: 8, total: 0, totalPages: 1 } };
  });
  render(<MemoryRouter initialEntries={['/reception']}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ToastContext.Provider value={() => {}}><AuthContext.Provider value={{ user: mockStaffUser, notice: null, login: async () => mockStaffUser, logout: () => {}, updateUser: () => true }}><ReceptionDashboard /></AuthContext.Provider></ToastContext.Provider></QueryClientProvider></MemoryRouter>);
  const statusText = await screen.findByText(label);
  const card = statusText.closest('button')!;
  expect(card.textContent).not.toContain('TRỐNG SẠCH');
  expect(card.textContent).toContain('Khách vừa đặt');
  fireEvent.click(card);
  expect(screen.getByRole('link', { name: 'Xem booking · Xác nhận / Nhận phòng' }).getAttribute('href')).toBe('/reception/bookings/reserved-booking');
  expect(screen.queryByRole('button', { name: /Đặt phòng này/ })).toBeNull();
});
