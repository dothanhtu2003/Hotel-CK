import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import {
  BedDouble,
  ConciergeBell,
  LogOut,
  Menu,
  Plus,
  ReceiptText,
  UserRound,
  Compass,
} from 'lucide-react';
import { Brand } from './public-layout';
import { useAuth } from '../features/auth/auth-context';
import { homeForRole } from '../features/auth/contracts';
import { Button, Dialog, LinkButton } from '../components/ui';
import { useToast } from '../components/toast-context';

export function GuestPortalLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  if (!user) return null;
  const home = homeForRole[user.role] ?? '/guest';

  const navLinks = [
    {
      to: `${home}/bookings`,
      label: 'Kỳ nghỉ của tôi',
      icon: BedDouble,
      isActive: (path: string) => path.startsWith(`${home}/bookings`),
    },
    {
      to: `${home}/services`,
      label: 'Dịch vụ phòng',
      icon: ConciergeBell,
      isActive: (path: string) => path.startsWith(`${home}/services`) || path.startsWith(`${home}/service-orders`),
    },
    {
      to: `${home}/billing`,
      label: 'Chi phí & Hóa đơn',
      icon: ReceiptText,
      isActive: (path: string) => path.startsWith(`${home}/billing`) || path.startsWith(`${home}/invoices`),
    },
    {
      to: `${home}/profile`,
      label: 'Hồ sơ cá nhân',
      icon: UserRound,
      isActive: (path: string) => path.startsWith(`${home}/profile`),
    },
  ];

  const firstLetter = (user.fullName || 'Khách').trim().charAt(0).toUpperCase();

  return (
    <div className="guest-portal-root">
      <a className="skip-link" href="#guest-portal-content">
        Đến nội dung chính
      </a>

      {/* Guest Portal Top Header */}
      <header className="guest-portal-header">
        <div className="site-container guest-portal-header-inner">
          <div className="guest-portal-brand-wrap">
            <Brand />
            <span className="guest-portal-badge">Không gian khách lưu trú</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="guest-portal-nav" aria-label="Điều hướng tài khoản khách">
            {navLinks.map(({ to, label, icon: Icon, isActive }) => {
              const active = isActive(location.pathname);
              return (
                <NavLink
                  key={to}
                  to={to}
                  className={`guest-portal-nav-item ${active ? 'is-active' : ''}`}
                >
                  <Icon size={16} strokeWidth={1.8} />
                  <span>{label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Actions & Profile */}
          <div className="guest-portal-actions">
            <LinkButton to="/rooms" variant="secondary" className="guest-portal-explore-btn">
              <Plus size={15} />
              <span>Đặt thêm phòng</span>
            </LinkButton>

            <div className="guest-portal-user-chip">
              <div className="guest-portal-avatar" aria-hidden="true">
                {firstLetter}
              </div>
              <div className="guest-portal-user-meta">
                <span className="guest-portal-greeting">Kính chào</span>
                <strong className="guest-portal-user-name">{user.fullName || 'Quý khách'}</strong>
              </div>
              <button
                type="button"
                className="guest-portal-logout-icon-btn"
                title="Đăng xuất"
                aria-label="Đăng xuất"
                onClick={() => setLogoutOpen(true)}
              >
                <LogOut size={16} />
              </button>
            </div>

            <button
              type="button"
              className="guest-portal-mobile-menu-btn icon-button"
              aria-label="Mở menu"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Navigation */}
      <Dialog
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        title="Không gian của bạn"
        className="mobile-navigation"
      >
        <div className="guest-mobile-menu-user-card">
          <div className="guest-portal-avatar large">{firstLetter}</div>
          <div>
            <strong>{user.fullName || 'Quý khách'}</strong>
            <p>{user.email}</p>
          </div>
        </div>
        <nav onClick={() => setMobileMenuOpen(false)}>
          {navLinks.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className="guest-mobile-nav-item">
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          ))}
          <Link to="/rooms" className="guest-mobile-nav-item highlight">
            <Compass size={18} />
            <span>Khám phá & đặt phòng</span>
          </Link>
          <button
            type="button"
            className="guest-mobile-logout-btn"
            onClick={() => {
              setMobileMenuOpen(false);
              setLogoutOpen(true);
            }}
          >
            <LogOut size={18} />
            <span>Đăng xuất</span>
          </button>
        </nav>
      </Dialog>

      {/* Main Content Area */}
      <main id="guest-portal-content" className="guest-portal-main">
        <div className="site-container guest-portal-container">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar for rapid thumb access */}
      <nav className="guest-portal-bottom-bar" aria-label="Thanh điều hướng di động">
        {navLinks.map(({ to, label, icon: Icon, isActive }) => {
          const active = isActive(location.pathname);
          return (
            <NavLink
              key={to}
              to={to}
              className={`guest-bottom-nav-item ${active ? 'is-active' : ''}`}
            >
              <Icon size={19} strokeWidth={active ? 2.2 : 1.7} />
              <span>{label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Guest Portal Footer */}
      <footer className="guest-portal-footer">
        <div className="site-container guest-portal-footer-inner">
          <div className="guest-portal-footer-brand">
            <Brand />
            <p>Một khoảng lặng. Một kỳ nghỉ trọn vẹn.</p>
          </div>
          <div className="guest-portal-footer-links">
            <Link to="/">Trang chủ khách sạn</Link>
            <Link to="/rooms">Danh mục phòng nghỉ</Link>
            <a href="tel:19000000" title="Liên hệ Lễ tân 24/7">Hotline lễ tân 24/7</a>
          </div>
          <span className="guest-portal-copyright">
            © {new Date().getFullYear()} An Nhiên Hotel & Suites · Topic 14
          </span>
        </div>
      </footer>

      {/* Logout Confirmation Dialog */}
      <Dialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title="Đăng xuất tài khoản?"
      >
        <p>
          Bạn sẽ đăng xuất khỏi tài khoản của mình trên thiết bị này. Lần tiếp theo bạn có thể đăng nhập lại bất cứ lúc nào.
        </p>
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setLogoutOpen(false)}>
            Ở lại
          </Button>
          <Button
            onClick={() => {
              logout();
              toast('Đã đăng xuất tài khoản.');
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
