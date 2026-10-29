import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import { useAuth } from './features/auth/auth-context';
import { homeForRole, type Role } from './features/auth/contracts';
import { PublicLayout } from './layouts/public-layout';
import { WorkspaceLayout } from './layouts/workspace-layout';
import { RoomsPage, RoomDetailPage } from './pages/room-pages';
import { MyBookingsPage, BookingDetailPage } from './pages/booking-pages';
import { ServicesPage, MyServiceOrdersPage } from './pages/service-pages';
import { BookingBillingPage, InvoicePage } from './pages/billing-pages';
const ReceptionDashboard = lazy(async () => ({ default: (await import('./pages/front-desk-pages')).ReceptionDashboard }));
const ReceptionBookingsPage = lazy(async () => ({ default: (await import('./pages/front-desk-pages')).ReceptionBookingsPage }));
const ReceptionBookingDetailPage = lazy(async () => ({ default: (await import('./pages/reception-booking-pages')).ReceptionBookingDetailPage }));
const ReceptionRoomBoard = lazy(async () => ({ default: (await import('./pages/front-desk-pages')).ReceptionRoomBoard }));
const ReceptionWalkIn = lazy(async () => ({ default: (await import('./pages/front-desk-pages')).ReceptionWalkIn }));
const ReceptionOrdersPage = lazy(async () => ({ default: (await import('./pages/reception-service-pages')).ReceptionOrdersPage }));
const ReceptionOrderDetailPage = lazy(async () => ({ default: (await import('./pages/reception-service-pages')).ReceptionOrderDetailPage }));
const ReceptionBillingPage = lazy(async () => ({ default: (await import('./pages/reception-billing-pages')).ReceptionBillingPage }));
const ReceptionInvoicePage = lazy(async () => ({ default: (await import('./pages/reception-billing-pages')).ReceptionInvoicePage }));
const HousekeepingDashboard = lazy(async () => ({ default: (await import('./pages/housekeeping-pages')).HousekeepingDashboard }));
const HousekeepingBoardPage = lazy(async () => ({ default: (await import('./pages/housekeeping-pages')).HousekeepingBoardPage }));
const HousekeepingTasksPage = lazy(async () => ({ default: (await import('./pages/housekeeping-pages')).HousekeepingTasksPage }));
const HousekeepingTaskDetailPage = lazy(async () => ({ default: (await import('./pages/housekeeping-pages')).HousekeepingTaskDetailPage }));
import { HomePage } from './pages/home-page';
import { LoginPage, RegisterPage } from './pages/auth-pages';
import { ProfilePage, EditProfilePage } from './pages/profile-pages';
import { ComingSoonPage, OverviewPage } from './pages/workspace-pages';
import { NotFoundPage } from './pages/not-found-page';
import { LinkButton, LoadingState } from './components/ui';

function RoleGuard({ role }: { role: Role }) {
  const { user } = useAuth(), location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (user.role !== role && !(role === 'RECEPTIONIST' && user.role === 'ADMIN')) return <main className="access-denied"><p className="eyebrow">403 · QUYỀN TRUY CẬP</p><h1>Không gian này<br />dành cho <em>vai trò khác.</em></h1><p>Tài khoản hiện tại không có quyền truy cập khu vực này.</p><LinkButton to={homeForRole[user.role]}>Về không gian của bạn</LinkButton></main>;
  return <Outlet />;
}
function RouteEffects() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); document.title = `${pathname === '/login' ? 'Đăng nhập' : pathname === '/register' ? 'Tạo tài khoản' : pathname.includes('/profile') ? 'Hồ sơ cá nhân' : pathname === '/' ? 'Một kỳ nghỉ trọn vẹn' : 'Không gian của bạn'} · An Nhiên Hotel`; }, [pathname]);
  return null;
}
export function App() {
  return <BrowserRouter><RouteEffects /><Suspense fallback={<LoadingState />}><Routes><Route element={<PublicLayout />}><Route index element={<HomePage />} /><Route path="rooms" element={<RoomsPage />} /><Route path="rooms/:id" element={<RoomDetailPage />} /><Route path="*" element={<NotFoundPage />} /></Route><Route path="login" element={<LoginPage />} /><Route path="register" element={<RegisterPage />} />{(Object.entries(homeForRole) as [Role, string][]).map(([role, home]) => <Route key={role} element={<RoleGuard role={role} />}><Route path={home} element={<WorkspaceLayout />}><Route index element={role === 'RECEPTIONIST' || role === 'ADMIN' ? <ReceptionDashboard /> : role === 'HOUSEKEEPING' ? <HousekeepingDashboard /> : <OverviewPage />} /><Route path="profile" element={<ProfilePage />} /><Route path="profile/edit" element={<EditProfilePage />} />{role === 'GUEST' && <><Route path="bookings" element={<MyBookingsPage />} /><Route path="bookings/:id" element={<BookingDetailPage />} /><Route path="bookings/:id/billing" element={<BookingBillingPage />} /><Route path="services" element={<ServicesPage />} /><Route path="service-orders" element={<MyServiceOrdersPage />} /><Route path="billing" element={<MyBookingsPage billing />} /><Route path="invoices/:id" element={<InvoicePage />} /></>}{(role === 'RECEPTIONIST' || role === 'ADMIN') && <><Route path="bookings" element={<ReceptionBookingsPage />} /><Route path="rooms" element={<ReceptionRoomBoard />} /><Route path="walk-in" element={<ReceptionWalkIn />} /><Route path="bookings/:id" element={<ReceptionBookingDetailPage />} /><Route path="bookings/:id/billing" element={<ReceptionBillingPage />} /><Route path="service-orders" element={<ReceptionOrdersPage />} /><Route path="service-orders/:id" element={<ReceptionOrderDetailPage />} /><Route path="billing" element={<ReceptionBookingsPage billing />} /><Route path="invoices/:id" element={<ReceptionInvoicePage />} /><Route path="housekeeping" element={<HousekeepingBoardPage />} /><Route path="housekeeping/tasks" element={<HousekeepingTasksPage />} /><Route path="housekeeping/tasks/:id" element={<HousekeepingTaskDetailPage />} /></>}{role === 'HOUSEKEEPING' && <><Route path="board" element={<HousekeepingBoardPage />} /><Route path="tasks" element={<HousekeepingTasksPage />} /><Route path="tasks/:id" element={<HousekeepingTaskDetailPage />} /></>}<Route path=":feature" element={<ComingSoonPage />} /></Route></Route>)}</Routes></Suspense></BrowserRouter>;
}
