import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { ArrowUpRight, ChevronDown, LayoutDashboard, LogOut, Menu, Search, ShieldCheck, UserRound } from 'lucide-react';
import { Brand } from './public-layout';
import { useAuth } from '../features/auth/auth-context';
import { homeForRole, roleLabel } from '../features/auth/contracts';
import { featuresForRole } from '../features/workspace/navigation';
import { Button, Dialog, StatusBadge } from '../components/ui';
import { readAttempt } from '../features/reception/payment-attempt';
import { useToast } from '../components/toast-context';

export function WorkspaceLayout() {
  const { user, logout } = useAuth(), navigate = useNavigate(), toast = useToast(), location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false), [logoutOpen, setLogoutOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
  const home = user.role === 'ADMIN' && location.pathname.startsWith('/reception') ? '/reception' : homeForRole[user.role];
  const features = featuresForRole[user.role];
  const title = location.pathname.includes('/profile')
    ? 'Hồ sơ cá nhân'
    : location.pathname.includes('/invoices/') || location.pathname.endsWith('/billing')
    ? 'Hóa đơn & thanh toán'
    : features.find(f => location.pathname.includes('/' + f.slug))?.title ?? 'Tổng quan';

  const isReception = user.role === 'RECEPTIONIST';
  const primaryReceptionSlugs = ['bookings', 'walk-in', 'rooms'];
  const visibleNavFeatures = isReception
    ? features.filter(f => primaryReceptionSlugs.includes(f.slug))
    : features;
  const dropdownFeatures = isReception
    ? features.filter(f => !primaryReceptionSlugs.includes(f.slug))
    : [];

  const navigation = (
    <>
      <p className="nav-label">{user.role === 'GUEST' ? 'KHÔNG GIAN CỦA BẠN' : 'KHÔNG GIAN LÀM VIỆC'}</p>
      <nav className="workspace-nav" aria-label="Điều hướng tài khoản" onClick={() => setMobileOpen(false)}>
        <NavLink to={home} end>
          <LayoutDashboard size={19} />
          Tổng quan
        </NavLink>
        {visibleNavFeatures.map(({ slug, title, icon: Icon }) => (
          <NavLink key={slug} to={`${home}/${slug}`}>
            <Icon size={19} />
            <span>{title}</span>
          </NavLink>
        ))}
        {!isReception && (
          <>
            <span className="nav-divider" />
            <NavLink to={`${home}/profile`}>
              <UserRound size={19} />
              Hồ sơ cá nhân
            </NavLink>
          </>
        )}
      </nav>
    </>
  );

  const mobileNavigation = (
    <>
      <p className="nav-label">{user.role === 'GUEST' ? 'KHÔNG GIAN CỦA BẠN' : 'KHÔNG GIAN LÀM VIỆC'}</p>
      <nav className="workspace-nav" aria-label="Điều hướng tài khoản" onClick={() => setMobileOpen(false)}>
        <NavLink to={home} end>
          <LayoutDashboard size={19} />
          Tổng quan
        </NavLink>
        {features.map(({ slug, title, icon: Icon }) => (
          <NavLink key={slug} to={`${home}/${slug}`}>
            <Icon size={19} />
            <span>{title}</span>
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
    <div className={`workspace ${user.role === 'GUEST' ? 'guest-workspace' : 'staff-workspace'}`}>
      <a className="skip-link" href="#main-content">Đến nội dung chính</a>
      <aside className="workspace-sidebar">
        <Brand light />
        <div className="sidebar-role">
          {roleLabel[user.role]}
          <span>AN NHIÊN HOTEL & SUITES</span>
        </div>
        {navigation}
        {(user.role === 'RECEPTIONIST' || user.role === 'ADMIN') && (
          <form
            className="desk-quick-search-hidden"
            role="search"
            onSubmit={e => {
              e.preventDefault();
              const q = String(new FormData(e.currentTarget).get('q') ?? '').trim();
              if (q) navigate(`${home}/bookings?q=${encodeURIComponent(q)}`);
            }}
          >
            <input aria-label="Tìm nhanh booking" name="q" maxLength={120} placeholder="Tìm khách, booking, số phòng…" required />
            <button aria-label="Tìm booking"><Search size={17} /></button>
          </form>
        )}
        {isReception ? (
          <div className="sidebar-bottom">
            <div className="sidebar-user-container" ref={dropdownRef}>
              <button
                type="button"
                className={`sidebar-user-trigger ${userDropdownOpen ? 'active' : ''}`}
                onClick={() => setUserDropdownOpen(prev => !prev)}
                aria-expanded={userDropdownOpen}
                aria-haspopup="true"
                title="Tùy chọn tài khoản & nghiệp vụ bổ sung"
              >
                <span className="sidebar-user-avatar">{user.fullName.slice(0, 1).toUpperCase()}</span>
                <div className="sidebar-user-info">
                  <strong className="sidebar-user-name">{user.fullName}</strong>
                  <small className="sidebar-user-role">{roleLabel[user.role]}</small>
                </div>
                <ChevronDown size={14} className={`sidebar-user-chevron ${userDropdownOpen ? 'open' : ''}`} />
              </button>

              {userDropdownOpen && (
                <div className="sidebar-user-dropdown" role="menu">
                  <div className="sidebar-dropdown-header">
                    <div className="sidebar-dropdown-user">
                      <span className="sidebar-dropdown-avatar">{user.fullName.slice(0, 1).toUpperCase()}</span>
                      <div>
                        <p className="sidebar-dropdown-name">{user.fullName}</p>
                        <p className="sidebar-dropdown-email">{user.email}</p>
                      </div>
                    </div>
                    <span className="sidebar-dropdown-badge">{roleLabel[user.role]}</span>
                  </div>

                  <div className="sidebar-dropdown-section">
                    <span className="sidebar-dropdown-label">TÙY CHỌN NGHIỆP VỤ</span>
                    <NavLink
                      to={`${home}/profile`}
                      className="sidebar-dropdown-item"
                      onClick={() => setUserDropdownOpen(false)}
                    >
                      <UserRound size={16} />
                      <span>Hồ sơ cá nhân</span>
                    </NavLink>
                    {dropdownFeatures.map(({ slug, title, icon: Icon }) => (
                      <NavLink
                        key={slug}
                        to={`${home}/${slug}`}
                        className="sidebar-dropdown-item"
                        onClick={() => setUserDropdownOpen(false)}
                      >
                        <Icon size={16} />
                        <span>{title}</span>
                      </NavLink>
                    ))}
                  </div>

                  <div className="sidebar-dropdown-divider" />

                  <div className="sidebar-dropdown-section">
                    <span className="sidebar-dropdown-label">HỆ THỐNG</span>
                    <Link
                      to="/"
                      className="sidebar-dropdown-item"
                      onClick={() => setUserDropdownOpen(false)}
                    >
                      <ArrowUpRight size={16} />
                      <span>Ghé thăm website</span>
                    </Link>
                    <button
                      type="button"
                      className="sidebar-dropdown-item sidebar-dropdown-logout"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        setLogoutOpen(true);
                      }}
                    >
                      <LogOut size={16} />
                      <span>Đăng xuất tài khoản</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="sidebar-bottom">
            <Link to="/"><ArrowUpRight size={17} />Ghé thăm website</Link>
            <button onClick={() => setLogoutOpen(true)}><LogOut size={17} />Đăng xuất</button>
            <div className="sidebar-user">
              <span>{user.fullName.slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{user.fullName}</strong>
                <small>{roleLabel[user.role]}</small>
              </div>
            </div>
          </div>
        )}
      </aside>

      <div className="workspace-main">
        <header className="workspace-topbar">
          <div>
            <button className="mobile-menu icon-button" aria-label="Mở menu tài khoản" onClick={() => setMobileOpen(true)}>
              <Menu />
            </button>
            <span>An Nhiên <span className="breadcrumb-slash">/</span><strong>{title}</strong></span>
          </div>
          <div>
            <StatusBadge tone="success">Đã xác thực</StatusBadge>
            <Link to={`${home}/profile`} className="topbar-avatar" aria-label="Xem hồ sơ cá nhân">
              {user.fullName.slice(0, 1).toUpperCase()}
            </Link>
            <button className="icon-button topbar-logout" aria-label="Đăng xuất" onClick={() => setLogoutOpen(true)}>
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main id="main-content" className="workspace-content">
          <PendingReceiptNotice userId={user.id} home={home} enabled={user.role === 'ADMIN' || user.role === 'RECEPTIONIST'} />
          <Outlet />
        </main>

        <footer className="workspace-footer">
          <span>© {new Date().getFullYear()} An Nhiên Hotel & Suites</span>
          <span>Chăm chút từng trải nghiệm.</span>
        </footer>
      </div>

      <Dialog open={mobileOpen} onClose={() => setMobileOpen(false)} title="Không gian của bạn" className="workspace-mobile-dialog">
        {mobileNavigation}
        <Button variant="secondary" onClick={() => { setMobileOpen(false); setLogoutOpen(true); }}>
          <LogOut size={17} />
          Đăng xuất
        </Button>
      </Dialog>

      <Dialog open={logoutOpen} onClose={() => setLogoutOpen(false)} title="Đăng xuất tài khoản?">
        <div className="dialog-icon"><ShieldCheck size={29} /></div>
        <p>Bạn sẽ đăng xuất khỏi tab này. Lần truy cập tiếp theo cần đăng nhập lại.</p>
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setLogoutOpen(false)}>Ở lại</Button>
          <Button onClick={() => { logout(); toast('Đã đăng xuất trên thiết bị này.'); navigate('/login', { replace: true }); }}>
            Xác nhận đăng xuất
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function PendingReceiptNotice({ userId, home, enabled }: { userId: string; home: string; enabled: boolean }) {
  if (!enabled) return null;
  let attempt;
  let failed = false;
  try {
    attempt = readAttempt(userId);
  } catch {
    failed = true;
  }
  if (failed) return <p className="form-error" role="alert">Không đọc được thông tin khoản thu chờ kiểm tra trong phiên trình duyệt.</p>;
  return attempt ? (
    <p className="notice">
      Có khoản thu cần đối chiếu. <Link to={`${home}/invoices/${attempt.invoiceId}`}>Mở hóa đơn cần kiểm tra</Link>
    </p>
  ) : null;
}
