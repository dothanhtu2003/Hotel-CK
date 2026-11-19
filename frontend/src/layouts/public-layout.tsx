import { LanguageSwitcher } from "../i18n/language-switcher";
import { t as tr, useLocale } from "../i18n";
import { Trans } from "react-i18next";
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { ArrowUpRight, Menu } from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import { homeForRole } from '../features/auth/contracts';
import { Dialog, LinkButton } from '../components/ui';

export function Brand({ light = false }: { light?: boolean }) {
  useLocale();
  return (
    <Link to="/" className={`brand ${light ? 'brand-light' : ''}`} aria-label={tr("common:supplement.anNhiNHotelHome")}>
      <span className="brand-symbol" aria-hidden="true">A<span>✦</span></span>
      <span className="brand-wordmark"><Trans ns="common" i18nKey="publicLayout.anNhienHotelSuites" components={{ part0: <small /> }} /></span>
    </Link>
  );
}

export function PublicHeader() {
  useLocale();
  const { user } = useAuth();
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === '/';
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!isHome) return;
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };
    const frame = requestAnimationFrame(handleScroll);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', handleScroll); };
  }, [isHome]);

  const isLight = isHome;
  const headerClass = [
    'public-header',
    isHome ? 'public-header-hero' : '',
    isHome && scrolled ? 'is-scrolled' : '',
  ].filter(Boolean).join(' ');

  return (
    <header className={headerClass}>
      <div className="site-container header-inner">
        <Brand light={isLight} />
        <nav className="desktop-nav" aria-label={tr("common:publicLayout.mainNavigation")}>
          <NavLink to="/" end>{tr("common:publicLayout.home")}</NavLink>
          <NavLink to="/rooms">{tr("common:publicLayout.roomsReservations")}</NavLink>
        </nav>
        <div className="header-actions">
          <LanguageSwitcher />
          <LinkButton
            to={user ? (user.role === 'GUEST' ? '/guest/bookings' : homeForRole[user.role]) : '/login'}
            variant={isLight && !scrolled ? 'light' : 'secondary'}
            className="header-login"
          >
            {user ? (
              <>
                <span className="header-avatar-circle" aria-hidden="true">
                  {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'A'}
                </span>
                <span className="header-user-name">{user.fullName || tr("common:guestPortalLayout.yourWorkspace")}</span>
              </>
            ) : (
              tr("common:publicLayout.signIn")
            )}
            <ArrowUpRight size={16} />
          </LinkButton>
          <button className="mobile-menu icon-button" aria-label={tr("common:guestPortalLayout.openMenu")} onClick={() => setMenu(true)}>
            <Menu />
          </button>
        </div>
      </div>
      <Dialog open={menu} onClose={() => setMenu(false)} title={tr("common:publicLayout.exploreAnNhien")} className="mobile-navigation">
        <nav onClick={() => setMenu(false)}>
          <Link to="/">{tr("common:publicLayout.home")}</Link>
          <NavLink to="/rooms">{tr("common:publicLayout.roomsReservations")}</NavLink>
          <Link to={user ? (user.role === 'GUEST' ? '/guest/bookings' : homeForRole[user.role]) : '/login'}>{user ? (user.fullName || tr("common:guestPortalLayout.yourWorkspace")) : tr("common:publicLayout.signIn")}</Link>
        </nav>
      </Dialog>
    </header>
  );
}

export function PublicFooter() {
  useLocale();
  return (
    <footer className="public-footer">
      <div className="site-container footer-inner">
        <Brand />
        <p>{tr("common:guestPortalLayout.aMomentOfCalmACompleteGetaway")}</p>
        <span>{tr("common:publicLayout.valueAnNhienTopic14Project", { value0: (new Date().getFullYear()) })}</span>
      </div>
    </footer>
  );
}

export function PublicLayout() {
  useLocale();
  return (
    <>
      <a className="skip-link" href="#main-content">{tr("common:guestPortalLayout.skipToMainContent")}</a>
      <PublicHeader />
      <main id="main-content"><Outlet /></main>
      <PublicFooter />
    </>
  );
}
