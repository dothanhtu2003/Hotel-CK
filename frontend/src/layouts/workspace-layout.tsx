import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import {
  ArrowUpRight,
  Brush,
  CalendarDays,
  ChevronDown,
  ConciergeBell,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Menu,
  Moon,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
  Sun,
  UserRound,
  Users,
} from 'lucide-react';
import { Brand } from './public-layout';
import { useAuth } from '../features/auth/auth-context';
import { homeForRole, roleLabel } from '../features/auth/contracts';
import { featuresForRole } from '../features/workspace/navigation';
import { Button, Dialog, StatusBadge } from '../components/ui';
import { readAttempt } from '../features/reception/payment-attempt';
import { useToast } from '../components/toast-context';
import { CommandPalette } from '../components/command-palette';

export function WorkspaceLayout() {
  const { user, logout } = useAuth(),
    navigate = useNavigate(),
    toast = useToast(),
    location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false),
    [logoutOpen, setLogoutOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isMac = typeof navigator !== "undefined" && /Mac|iP(hone|ad|od)/.test(navigator.platform);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!userDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [userDropdownOpen]);

  if (!user) return null;
  const home =
    user.role === 'ADMIN' && location.pathname.startsWith('/reception')
      ? '/reception'
      : homeForRole[user.role];
  const features = featuresForRole[user.role];
  const title = location.pathname.includes('/profile')
    ? 'Hồ sơ cá nhân'
    : location.pathname.includes('/invoices/') || location.pathname.endsWith('/billing')
    ? 'Hóa đơn & thanh toán'
    : features.find((f) => location.pathname.includes('/' + f.slug))?.title ?? 'Tổng quan';

  const isReception = user.role === 'RECEPTIONIST' || user.role === 'ADMIN';

  // Kamra-style grouped navigation for reception
  const receptionNavigation = (
    <nav className="flex-1 space-y-4 px-1" aria-label="Điều hướng lễ tân" onClick={() => setMobileOpen(false)}>
      <div>
        <div className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
          VẬN HÀNH (FRONT DESK)
        </div>
        <div className="space-y-0.5">
          <NavLink
            to={home}
            end
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-50 text-brand-700 font-semibold'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              }`
            }
          >
            <LayoutDashboard className="size-4 shrink-0" />
            <span>Hôm nay</span>
          </NavLink>
          <NavLink
            to={`${home}/bookings`}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-50 text-brand-700 font-semibold'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              }`
            }
          >
            <Users className="size-4 shrink-0" />
            <span>Quản lý booking</span>
          </NavLink>
          <NavLink
            to={`${home}/tape-chart`}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-50 text-brand-700 font-semibold'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              }`
            }
          >
            <CalendarDays className="size-4 shrink-0" />
            <span>Tape Chart</span>
          </NavLink>
        </div>
      </div>

      <div>
        <div className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
          DỊCH VỤ & BUỒNG PHÒNG
        </div>
        <div className="space-y-0.5">
          <NavLink
            to={`${home}/service-orders`}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-50 text-brand-700 font-semibold'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              }`
            }
          >
            <ConciergeBell className="size-4 shrink-0" />
            <span>Đơn dịch vụ phòng</span>
          </NavLink>
          <NavLink
            to={`${home}/housekeeping`}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-50 text-brand-700 font-semibold'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              }`
            }
          >
            <Brush className="size-4 shrink-0" />
            <span>Buồng phòng</span>
          </NavLink>
        </div>
      </div>

      <div>
        <div className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
          TÀI CHÍNH & THU NGÂN
        </div>
        <div className="space-y-0.5">
          <NavLink
            to={`${home}/billing`}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-50 text-brand-700 font-semibold'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              }`
            }
          >
            <ReceiptText className="size-4 shrink-0" />
            <span>Hóa đơn & thanh toán</span>
          </NavLink>
        </div>
      </div>

      <div className="pt-2 border-t border-zinc-200">
        <NavLink
          to={`${home}/profile`}
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-brand-50 text-brand-700 font-semibold'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
            }`
          }
        >
          <UserRound className="size-4 shrink-0" />
          <span>Hồ sơ cá nhân</span>
        </NavLink>
      </div>
    </nav>
  );

  // Standard non-reception navigation (Guest, Housekeeping)
  const defaultNavigation = (
    <>
      <p className="nav-label">{user.role === 'GUEST' ? 'KHÔNG GIAN CỦA BẠN' : 'KHÔNG GIAN LÀM VIỆC'}</p>
      <nav className="workspace-nav" aria-label="Điều hướng tài khoản" onClick={() => setMobileOpen(false)}>
        <NavLink to={home} end>
          <LayoutDashboard size={19} />
          Tổng quan
        </NavLink>
        {features.map(({ slug, title: fTitle, icon: Icon }) => (
          <NavLink key={slug} to={`${home}/${slug}`}>
            <Icon size={19} />
            <span>{fTitle}</span>
          </NavLink>
        ))}
        <span className="nav-divider" />
        <NavLink to={`${home}/profile`}>
          <UserRound size={19} />
          Hồ sơ cá nhân
        </NavLink>
      </nav>
    </>
  );

  return (
    <div
      className={`workspace ${
        user.role === 'GUEST'
          ? 'guest-workspace'
          : isReception
          ? 'staff-workspace kamra-workspace'
          : 'staff-workspace'
      }`}
    >
      <a className="skip-link" href="#main-content">
        Đến nội dung chính
      </a>

      {/* Sidebar */}
      <aside className="workspace-sidebar">
        {isReception ? (
          <>
            <NavLink
              to={home}
              end
              className="mb-4 flex items-center gap-2 rounded-lg px-2 outline-none"
              aria-label="Trang chủ lễ tân"
            >
              <div className="flex size-7 items-center justify-center rounded-lg bg-brand-600 text-white font-bold text-sm shadow-sm">
                A
              </div>
              <span className="text-lg font-semibold tracking-tight text-zinc-900">
                an nhiên
                <span className="ml-1 align-middle text-[10px] font-semibold tracking-[0.2em] text-brand-600">
                  PMS
                </span>
              </span>
            </NavLink>

            <div className="sidebar-role mb-4 flex items-center gap-2 rounded-lg bg-brand-50 px-2.5 py-1.5 text-brand-800">
              <span className="flex size-5 items-center justify-center rounded bg-brand-600 text-white">
                <LayoutDashboard className="size-3" />
              </span>
              <strong className="text-xs font-semibold text-brand-900">{roleLabel[user.role]}</strong>
            </div>

            {receptionNavigation}

            {(user.role === 'RECEPTIONIST' || user.role === 'ADMIN') && (
              <form
                className="desk-quick-search-hidden px-1 pt-2"
                role="search"
                onSubmit={e => {
                  e.preventDefault();
                  const input = e.currentTarget.elements.namedItem('q') as HTMLInputElement | null;
                  const q = input?.value.trim() ?? '';
                  if (q) navigate(`${home}/bookings?q=${encodeURIComponent(q)}`);
                }}
              >
                <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white p-1 shadow-2xs">
                  <input
                    aria-label="Tìm nhanh booking"
                    name="q"
                    maxLength={120}
                    placeholder="Tìm nhanh booking…"
                    className="w-full bg-transparent px-1.5 py-0.5 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none"
                  />
                  <button
                    aria-label="Tìm booking"
                    type="submit"
                    className="flex size-6 shrink-0 items-center justify-center rounded bg-brand-50 text-brand-700 hover:bg-brand-100 cursor-pointer"
                  >
                    <Search size={13} />
                  </button>
                </div>
              </form>
            )}

            <div className="mt-auto pt-4 border-t border-zinc-200">
              <div className="sidebar-user-container relative" ref={dropdownRef}>
                <button
                  type="button"
                  className={`sidebar-user-trigger flex w-full items-center gap-2.5 rounded-lg border border-zinc-200 bg-white p-2 text-start transition-colors hover:bg-zinc-50 ${
                    userDropdownOpen ? 'border-brand-600' : ''
                  }`}
                  onClick={() => setUserDropdownOpen((prev) => !prev)}
                  aria-expanded={userDropdownOpen}
                  aria-haspopup="true"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                    {user.fullName.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate text-xs font-semibold text-zinc-900">
                      {user.fullName}
                    </strong>
                    <small className="block truncate text-[10px] text-zinc-400">
                      {roleLabel[user.role]}
                    </small>
                  </div>
                  <ChevronDown
                    size={14}
                    className={`text-zinc-400 transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {userDropdownOpen && (
                  <div
                    className="absolute bottom-full left-0 z-50 mb-2 w-56 rounded-lg border border-zinc-200 bg-white p-1.5 shadow-xl"
                    role="menu"
                  >
                    <div className="border-b border-zinc-100 px-2 py-1.5 mb-1">
                      <p className="truncate text-xs font-medium text-zinc-900">{user.fullName}</p>
                      <p className="truncate text-[10px] text-zinc-400">{user.email}</p>
                    </div>
                    <NavLink
                      to={`${home}/profile`}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100"
                      onClick={() => setUserDropdownOpen(false)}
                    >
                      <UserRound size={14} />
                      <span>Hồ sơ cá nhân</span>
                    </NavLink>
                    <Link
                      to="/"
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100"
                      onClick={() => setUserDropdownOpen(false)}
                    >
                      <ArrowUpRight size={14} />
                      <span>Ghé thăm website</span>
                    </Link>
                    <div className="my-1 border-t border-zinc-100" />
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-rose-600 hover:bg-rose-50 cursor-pointer"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        setLogoutOpen(true);
                      }}
                    >
                      <LogOut size={14} />
                      <span>Đăng xuất tài khoản</span>
                    </button>
                  </div>
                )}
              </div>
              <p className="mt-2.5 px-2 text-[10px] text-zinc-400">
                Kamra PMS v2.4 · An Nhiên Hotel
              </p>
            </div>
          </>
        ) : (
          <>
            <Brand light={true} />
            <div className="sidebar-role">
              {roleLabel[user.role]}
              <span>AN NHIÊN HOTEL & SUITES</span>
            </div>
            {defaultNavigation}
            <div className="sidebar-bottom">
              <Link to="/">
                <ArrowUpRight size={17} />
                Ghé thăm website
              </Link>
              <button onClick={() => setLogoutOpen(true)}>
                <LogOut size={17} />
                Đăng xuất
              </button>
              <div className="sidebar-user">
                <span>{user.fullName.slice(0, 1).toUpperCase()}</span>
                <div>
                  <strong>{user.fullName}</strong>
                  <small>{roleLabel[user.role]}</small>
                </div>
              </div>
            </div>
          </>
        )}
      </aside>

      {/* Main Workspace Frame */}
      <div className="workspace-main">
        <header className="workspace-topbar">
          <div className="flex items-center gap-2.5">
            <button
              className="mobile-menu icon-button"
              aria-label="Mở menu tài khoản"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={18} />
            </button>
            {isReception ? (
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800">
                  <LayoutGrid className="size-4" />
                </span>
                <span className="font-semibold text-sm text-zinc-900">An Nhiên Hotel & Suites</span>
              </div>
            ) : (
              <span>
                An Nhiên <span className="breadcrumb-slash">/</span>
                <strong>{title}</strong>
              </span>
            )}
          </div>

          {/* Centered Kamra-style Search shortcut */}
          {isReception && (
            <div className="flex flex-1 justify-center px-4 max-w-md">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                title={`Tìm khách hoặc booking, hoặc nhảy nhanh đến mục khác (${isMac ? '⌘K' : 'Ctrl+K'})`}
                className="flex w-full items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors cursor-pointer"
              >
                <Search className="size-3.5 shrink-0" />
                <span className="truncate whitespace-nowrap">
                  Tìm khách, booking, số phòng…
                </span>
                <kbd className="ml-auto hidden rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 md:inline">
                  {isMac ? '⌘K' : 'Ctrl+K'}
                </kbd>
              </button>
            </div>
          )}

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {isReception && (
              <>
                <button
                  type="button"
                  onClick={() => setDark((d) => !d)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
                  title="Chế độ giao diện"
                  aria-label="Chế độ giao diện"
                >
                  {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
                </button>
                <span className="hidden text-xs text-zinc-500 xl:inline">{user.fullName}</span>
                <Link
                  to={`${home}?mode=booking`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 shadow-xs transition-colors"
                  aria-label="Đặt phòng mới"
                >
                  <Plus className="size-3.5" />
                  <span>Đặt phòng mới</span>
                </Link>
                <button
                  onClick={() => setLogoutOpen(true)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-zinc-700 cursor-pointer p-1"
                  title="Đăng xuất"
                  aria-label="Đăng xuất"
                >
                  <LogOut className="size-4" />
                </button>
              </>
            )}

            {!isReception && (
              <>
                <StatusBadge tone="success">Đã xác thực</StatusBadge>
                <Link to={`${home}/profile`} className="topbar-avatar" aria-label="Xem hồ sơ cá nhân">
                  {user.fullName.slice(0, 1).toUpperCase()}
                </Link>
                <button
                  className="icon-button topbar-logout"
                  aria-label="Đăng xuất"
                  onClick={() => setLogoutOpen(true)}
                >
                  <LogOut size={18} />
                </button>
              </>
            )}
          </div>
        </header>

        <main id="main-content" className="workspace-content">
          <PendingReceiptNotice
            userId={user.id}
            home={home}
            enabled={user.role === 'ADMIN' || user.role === 'RECEPTIONIST'}
          />
          <Outlet />
        </main>

        <footer className="workspace-footer">
          <span>© {new Date().getFullYear()} An Nhiên Hotel & Suites</span>
          <span>Chăm chút từng trải nghiệm. Vận hành bởi Kamra PMS.</span>
        </footer>
      </div>

      {/* Global Command Palette */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} home={home} />

      {/* Mobile Drawer */}
      <Dialog
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        title="Menu lễ tân"
        className="workspace-mobile-dialog"
      >
        {isReception ? receptionNavigation : defaultNavigation}
        <Button
          variant="secondary"
          onClick={() => {
            setMobileOpen(false);
            setLogoutOpen(true);
          }}
        >
          <LogOut size={17} />
          Đăng xuất
        </Button>
      </Dialog>

      {/* Logout Confirmation */}
      <Dialog open={logoutOpen} onClose={() => setLogoutOpen(false)} title="Đăng xuất tài khoản?">
        <div className="dialog-icon">
          <ShieldCheck size={29} />
        </div>
        <p>Bạn sẽ đăng xuất khỏi phiên làm việc này. Lần truy cập tiếp theo cần đăng nhập lại.</p>
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setLogoutOpen(false)}>
            Ở lại
          </Button>
          <Button
            onClick={() => {
              logout();
              toast('Đã đăng xuất trên thiết bị này.');
              navigate('/login', { replace: true });
            }}
          >
            Xác nhận đăng xuất
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function PendingReceiptNotice({
  userId,
  home,
  enabled,
}: {
  userId: string;
  home: string;
  enabled: boolean;
}) {
  if (!enabled) return null;
  let attempt;
  let failed = false;
  try {
    attempt = readAttempt(userId);
  } catch {
    failed = true;
  }
  if (failed)
    return (
      <p className="form-error" role="alert">
        Không đọc được thông tin khoản thu chờ kiểm tra trong phiên trình duyệt.
      </p>
    );
  return attempt ? (
    <p className="notice">
      Có khoản thu cần đối chiếu.{' '}
      <Link to={`${home}/invoices/${attempt.invoiceId}`}>Mở hóa đơn cần kiểm tra</Link>
    </p>
  ) : null;
}
