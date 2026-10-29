import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { ArrowUpRight, Menu } from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import { homeForRole } from '../features/auth/contracts';
import { Dialog, LinkButton } from '../components/ui';

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className={`brand ${light ? 'brand-light' : ''}`} aria-label="An Nhiên Hotel - Trang chủ">
      <span className="brand-symbol" aria-hidden="true">A<span>✦</span></span>
      <span className="brand-wordmark">AN NHIÊN<small>HOTEL & SUITES</small></span>
    </Link>
  );
}

export function PublicHeader() {
  const { user } = useAuth();
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === '/';
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!isHome) {
      setScrolled(false);
      return;
    }
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isHome]);

  const isLight = isHome;
  const headerClass = [
    'public-header',
    isHome ? 'public-header-hero' : '',
    scrolled ? 'is-scrolled' : '',
  ].filter(Boolean).join(' ');

  return (
    <header className={headerClass}>
      <div className="site-container header-inner">
        <Brand light={isLight} />
        <nav className="desktop-nav" aria-label="Điều hướng chính">
          <NavLink to="/" end>Trang chủ</NavLink>
          <NavLink to="/rooms">Phòng & đặt phòng</NavLink>
          <a href="/#trai-nghiem">Trải nghiệm</a>
          <a href="/#ve-an-nhien">Về An Nhiên</a>
        </nav>
        <div className="header-actions">
          <span className="language-label">VI <span>/ EN</span></span>
          <LinkButton
            to={user ? homeForRole[user.role] : '/login'}
            variant={isLight && !scrolled ? 'light' : 'secondary'}
            className="header-login"
          >
            {user ? (
              <>
                <span className="header-avatar-circle" aria-hidden="true">
                  {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'A'}
                </span>
                <span className="header-user-name">{user.fullName || 'Không gian của bạn'}</span>
              </>
            ) : (
              'Đăng nhập'
            )}
            <ArrowUpRight size={16} />
          </LinkButton>
          <button className="mobile-menu icon-button" aria-label="Mở menu" onClick={() => setMenu(true)}>
            <Menu />
          </button>
        </div>
      </div>
      <Dialog open={menu} onClose={() => setMenu(false)} title="Khám phá An Nhiên" className="mobile-navigation">
        <nav onClick={() => setMenu(false)}>
          <Link to="/">Trang chủ</Link>
          <NavLink to="/rooms">Phòng & đặt phòng</NavLink>
          <a href="/#trai-nghiem">Trải nghiệm</a>
          <a href="/#ve-an-nhien">Về An Nhiên</a>
          <Link to={user ? homeForRole[user.role] : '/login'}>{user ? (user.fullName || 'Không gian của bạn') : 'Đăng nhập'}</Link>
        </nav>
      </Dialog>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="site-container footer-inner">
        <Brand />
        <p>Một khoảng lặng. Một kỳ nghỉ trọn vẹn.</p>
        <span>© {new Date().getFullYear()} An Nhiên · Đồ án Topic 14</span>
      </div>
    </footer>
  );
}

export function PublicLayout() {
  return (
    <>
      <a className="skip-link" href="#main-content">Đến nội dung chính</a>
      <PublicHeader />
      <main id="main-content"><Outlet /></main>
      <PublicFooter />
    </>
  );
}
