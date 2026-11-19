import { LanguageSwitcher } from "../i18n/language-switcher";
import { t as tr, useLocale } from "../i18n";
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import {
  ArrowUpRight,
  Brush,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Menu,
  Plus,
  ChartNoAxesCombined,
  ReceiptText,
  Search,
  ShieldCheck,
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
import { HousekeepingShiftProgress } from '../features/housekeeping/components';

export function WorkspaceLayout() {
  useLocale();
  const { user, logout } = useAuth(),
    navigate = useNavigate(),
    toast = useToast(),
    location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false),
    [logoutOpen, setLogoutOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
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
  const showRevenue = user.role === 'RECEPTIONIST' || home === '/reception';
  const isBillingPage = location.pathname.includes('/invoices/') || location.pathname.endsWith('/billing') || location.pathname.startsWith(`${home}/billing/`);
  const title = location.pathname === `${home}/revenue`
    ? tr("common:navigation.revenue")
    : location.pathname.includes('/profile')
    ? tr("common:guestPortalLayout.myProfile")
    : location.pathname.includes('/invoices/') || location.pathname.endsWith('/billing')
    ? tr("common:navigation.invoicesPayments")
    : features.find((f) => location.pathname.includes('/' + f.slug))?.title ?? tr("common:workspaceLayout.overview");

  const isReception = user.role === 'RECEPTIONIST' || user.role === 'ADMIN';
  const hideDesktopTopbar = isReception && location.pathname.replace(/\/+$/, '') !== home;

  // Kamra-style grouped navigation for reception
  const receptionNavigation = (
    <nav className="flex-1 space-y-4 px-1" aria-label={tr("common:workspaceLayout.receptionNavigation")} onClick={() => setMobileOpen(false)}>
      <div>
        <div className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{tr("common:workspaceLayout.frontDeskOperations")}</div>
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
            <span>{tr("common:workspaceLayout.today")}</span>
          </NavLink>
          <NavLink
            to={`${home}/bookings`}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                (isActive && (showRevenue || !isBillingPage))
                  ? 'bg-brand-50 text-brand-700 font-semibold'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              }`
            }
          >
            <Users className="size-4 shrink-0" />
            <span>{tr("common:navigation.manageReservations")}</span>
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
            <span>{tr("common:navigation.tapeChart")}</span>
          </NavLink>
        </div>
      </div>

      <div>
        <div className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{tr("common:workspaceLayout.housekeeping")}</div>
        <div className="space-y-0.5">
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
            <span>{tr("common:navigation.housekeeping")}</span>
          </NavLink>
        </div>
      </div>

      <div>
        <div className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{tr("common:workspaceLayout.financeCashier")}</div>
        <div className="space-y-0.5">
          <NavLink
            to={`${home}/${showRevenue ? 'revenue' : 'billing'}`}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                (isActive || (!showRevenue && isBillingPage))
                  ? 'bg-brand-50 text-brand-700 font-semibold'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              }`
            }
          >
            {showRevenue ? <ChartNoAxesCombined className="size-4 shrink-0" /> : <ReceiptText className="size-4 shrink-0" />}
            <span>{showRevenue ? tr("common:navigation.revenue") : tr("common:navigation.invoicesPayments")}</span>
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
          <span>{tr("common:guestPortalLayout.myProfile")}</span>
        </NavLink>
      </div>
    </nav>
  );

  // Standard non-reception navigation (Guest, Housekeeping)
  const defaultNavigation = (
    <>
      <p className="nav-label">{user.role === 'GUEST' ? tr("common:workspaceLayout.yourSpace") : tr("common:workspaceLayout.workspace")}</p>
      <nav className="workspace-nav" aria-label={tr("common:workspaceLayout.accountNavigation")} onClick={() => setMobileOpen(false)}>
        <NavLink to={home} end>
          <LayoutDashboard size={19} />
          {tr("common:workspaceLayout.overview")}</NavLink>
        {features.map(({ slug, title: fTitle, icon: Icon }) => (
          <NavLink key={slug} to={`${home}/${slug}`}>
            <Icon size={19} />
            <span>{fTitle}</span>
          </NavLink>
        ))}
        <span className="nav-divider" />
        <NavLink to={`${home}/profile`}>
          <UserRound size={19} />
          {tr("common:guestPortalLayout.myProfile")}</NavLink>
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
          : user.role === 'HOUSEKEEPING'
          ? 'staff-workspace housekeeping-workspace'
          : 'staff-workspace'
      } ${location.pathname.endsWith('/tape-chart') ? 'workspace-tape-chart' : ''} ${hideDesktopTopbar ? 'workspace-without-topbar' : ''}`}
    >
      <a className="skip-link" href="#main-content">{tr("common:guestPortalLayout.skipToMainContent")}</a>

      {/* Sidebar */}
      <aside className="workspace-sidebar">{isReception && hideDesktopTopbar && <div className="sidebar-language-switcher"><LanguageSwitcher /></div>}
        {isReception ? (
          <>
            <NavLink
              to={home}
              end
              className="mb-4 flex items-center gap-2 rounded-lg px-2 outline-none"
              aria-label={tr("common:workspaceLayout.receptionHome")}
            >
              <div className="flex size-7 items-center justify-center rounded-lg bg-brand-600 text-white font-bold text-sm shadow-sm">
                A
              </div>
              <span className="text-lg font-semibold tracking-tight text-zinc-900">
                {tr("common:workspaceLayout.anNhien")}<span className="ml-1 align-middle text-[10px] font-semibold tracking-[0.2em] text-brand-600">
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
                    aria-label={tr("common:workspaceLayout.quickReservationSearch")}
                    name="q"
                    maxLength={120}
                    placeholder={tr("common:workspaceLayout.quickReservationSearch2")}
                    className="w-full bg-transparent px-1.5 py-0.5 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none"
                  />
                  <button
                    aria-label={tr("common:workspaceLayout.findReservations")}
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
                      <span>{tr("common:guestPortalLayout.myProfile")}</span>
                    </NavLink>
                    <Link
                      to="/"
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100"
                      onClick={() => setUserDropdownOpen(false)}
                    >
                      <ArrowUpRight size={14} />
                      <span>{tr("common:workspaceLayout.visitWebsite")}</span>
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
                      <span>{tr("common:workspaceLayout.signOutOfAccount")}</span>
                    </button>
                  </div>
                )}
              </div>
              <p className="mt-2.5 px-2 text-[10px] text-zinc-400">{tr("common:workspaceLayout.kamraPmsV24AnNhienHotel")}</p>
            </div>
          </>
        ) : user.role === 'HOUSEKEEPING' ? (
          <div className="hk-topbar-wrapper flex items-center justify-between w-full h-full px-2">
            {/* Left: Brand + Role Badge */}
            <div className="flex items-center gap-3">
              <Link to={home} className="flex items-center gap-2 group outline-none">
                <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-sm shadow-2xs">
                  A
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold tracking-tight text-zinc-900">
                    AN NHIÊN
                  </span>
                  <span className="text-[9px] tracking-wider text-zinc-400 uppercase font-semibold">
                    Hotel & Suites
                  </span>
                </div>
              </Link>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 border border-zinc-200/80 shadow-2xs">
                <Brush className="size-3 text-zinc-500" />
                {tr("common:contracts.housekeepingStaff")}</span>
            </div>

            {/* Center: Main Navigation Tabs */}
            <nav className="flex items-center gap-1 sm:gap-1.5" aria-label={tr("common:workspaceLayout.housekeepingNavigation")}>
              <NavLink
                to={home}
                end
                className={({ isActive }) =>
                  `flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-brand-50 text-brand-800 font-semibold shadow-2xs border border-brand-200/60'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                  }`
                }
              >
                <LayoutDashboard className="size-3.5" />
                <span>{tr("common:workspaceLayout.overview")}</span>
              </NavLink>
              <NavLink
                to={`${home}/board`}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-brand-50 text-brand-800 font-semibold shadow-2xs border border-brand-200/60'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                  }`
                }
              >
                <Brush className="size-3.5" />
                <span>{tr("common:workspaceLayout.roomBoard")}</span>
              </NavLink>
              <NavLink
                to={`${home}/tasks`}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-brand-50 text-brand-800 font-semibold shadow-2xs border border-brand-200/60'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                  }`
                }
              >
                <ClipboardList className="size-3.5" />
                <span>{tr("common:workspaceLayout.tasks")}</span>
              </NavLink>
            </nav>

            {/* Right: Live Shift Progress & User Menu */}
            <div className="flex items-center gap-2.5">
              <LanguageSwitcher /><HousekeepingShiftProgress />

              <div className="sidebar-user-container relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-2 rounded-lg bg-white hover:bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors cursor-pointer border border-zinc-200 shadow-2xs"
                >
                  <span className="flex size-6 items-center justify-center rounded-full bg-brand-50 text-brand-700 font-bold text-xs">
                    {user.fullName.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="hidden sm:inline font-semibold max-w-[120px] truncate text-zinc-900">
                    {user.fullName}
                  </span>
                  <ChevronDown className={`size-3.5 text-zinc-400 transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl z-50 text-zinc-800 animate-fade-in">
                    <div className="px-3 py-2 border-b border-zinc-100">
                      <p className="font-semibold text-xs text-zinc-900 truncate">
                        {user.fullName}
                      </p>
                      <p className="text-[10px] text-zinc-400 truncate">
                        {user.email}
                      </p>
                      <span className="mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">{tr("common:contracts.housekeepingStaff")}</span>
                    </div>
                    <div className="py-1">
                      <NavLink
                        to={`${home}/profile`}
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-zinc-700 hover:bg-zinc-100 transition-colors"
                      >
                        <UserRound className="size-3.5 text-zinc-400" />
                        {tr("common:guestPortalLayout.myProfile")}</NavLink>
                    </div>
                    <div className="border-t border-zinc-100 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setUserDropdownOpen(false);
                          setLogoutOpen(true);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <LogOut className="size-3.5" />
                        {tr("common:guestPortalLayout.signOut")}</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
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
                {tr("common:workspaceLayout.visitWebsite")}</Link>
              <button onClick={() => setLogoutOpen(true)}>
                <LogOut size={17} />
                {tr("common:guestPortalLayout.signOut")}</button>
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
              aria-label={tr("common:workspaceLayout.openAccountMenu")}
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
                {tr("common:workspaceLayout.anNhien2")}<span className="breadcrumb-slash">/</span>
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
                title={tr("common:workspaceLayout.searchGuestsOrReservationsOrJumpToAnotherSectionValue", { value0: (isMac ? '⌘K' : 'Ctrl+K') })}
                className="flex w-full items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors cursor-pointer"
              >
                <Search className="size-3.5 shrink-0" />
                <span className="truncate whitespace-nowrap">{tr("common:workspaceLayout.searchGuestsReservationsOrRooms")}</span>
                <kbd className="ml-auto hidden rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 md:inline">
                  {isMac ? '⌘K' : 'Ctrl+K'}
                </kbd>
              </button>
            </div>
          )}

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3"><LanguageSwitcher />
            {isReception && (
              <>
                <Link
                  to={`${home}?mode=booking`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 shadow-xs transition-colors"
                  aria-label={tr("common:commandPalette.newReservation")}
                >
                  <Plus className="size-3.5" />
                  <span>{tr("common:commandPalette.newReservation")}</span>
                </Link>
              </>
            )}

            {!isReception && (
              <>
                <StatusBadge tone="success">{tr("common:workspaceLayout.verified")}</StatusBadge>
                <Link to={`${home}/profile`} className="topbar-avatar" aria-label={tr("common:workspaceLayout.viewProfile")}>
                  {user.fullName.slice(0, 1).toUpperCase()}
                </Link>
                <button
                  className="icon-button topbar-logout"
                  aria-label={tr("common:guestPortalLayout.signOut")}
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
          <span>{tr("common:workspaceLayout.valueAnNhienHotelSuites", { value0: (new Date().getFullYear()) })}</span>
          <span>{tr("common:workspaceLayout.careInEveryExperiencePoweredByKamraPms")}</span>
        </footer>
      </div>

      {/* Global Command Palette */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} home={home} />

      {/* Mobile Drawer */}
      <Dialog
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        title={isReception ? tr("common:workspaceLayout.receptionMenu") : tr("common:workspaceLayout.housekeepingMenu")}
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
          {tr("common:guestPortalLayout.signOut")}</Button>
      </Dialog>

      {/* Logout Confirmation */}
      <Dialog open={logoutOpen} onClose={() => setLogoutOpen(false)} title={tr("common:guestPortalLayout.signOutOfYourAccount")}>
        <div className="dialog-icon">
          <ShieldCheck size={29} />
        </div>
        <p>{tr("common:workspaceLayout.youWillBeSignedOutOfThisSessionPleaseSignInAgain")}</p>
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setLogoutOpen(false)}>{tr("common:guestPortalLayout.staySignedIn")}</Button>
          <Button
            onClick={() => {
              logout();
              toast(() => (tr("common:workspaceLayout.youHaveSignedOutOnThisDevice")));
              navigate('/login', { replace: true });
            }}
          >{tr("common:guestPortalLayout.confirmSignOut")}</Button>
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
  useLocale();
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
      <p className="form-error" role="alert">{tr("common:workspaceLayout.unableToReadThePendingReceiptInformationInThisBrowserSession")}</p>
    );
  return attempt ? (
    <p className="notice">
      {tr("common:workspaceLayout.aReceiptNeedsReview")}{' '}
      <Link to={`${home}/invoices/${attempt.invoiceId}`}>{tr("common:workspaceLayout.openInvoiceForReview")}</Link>
    </p>
  ) : null;
}
