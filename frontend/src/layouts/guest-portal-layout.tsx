import { LanguageSwitcher } from "../i18n/language-switcher";
import { t as tr, useLocale } from "../i18n";
import { ServicePaymentBadge, ServicePaymentNotice, usePendingServicePayments } from '../features/guest/service-payment-notice';
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
  useLocale();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const unpaidServiceOrders = usePendingServicePayments(user?.role === 'GUEST');
  if (!user) return null;
  const home = homeForRole[user.role] ?? '/guest';

  const navLinks = [
    {
      to: `${home}/bookings`,
      label: tr("common:guestPortalLayout.myStays"),
      icon: BedDouble,
      isActive: (path: string) => path.startsWith(`${home}/bookings`),
    },
    {
      to: `${home}/services`,
      label: tr("common:navigation.roomService"),
      icon: ConciergeBell,
      isActive: (path: string) => path.startsWith(`${home}/services`) || path.startsWith(`${home}/service-orders`),
    },
    {
      to: `${home}/billing`,
      label: tr("common:guestPortalLayout.chargesInvoices"),
      icon: ReceiptText,
      isActive: (path: string) => path.startsWith(`${home}/billing`) || path.startsWith(`${home}/invoices`),
    },
    {
      to: `${home}/profile`,
      label: tr("common:guestPortalLayout.myProfile"),
      icon: UserRound,
      isActive: (path: string) => path.startsWith(`${home}/profile`),
    },
  ];

  const firstLetter = (user.fullName || tr("common:guestPortalLayout.guest")).trim().charAt(0).toUpperCase();

  return (
    <div className="guest-portal-root">
      <a className="skip-link" href="#guest-portal-content">{tr("common:guestPortalLayout.skipToMainContent")}</a>

      {/* Guest Portal Top Header */}
      <header className="guest-portal-header">
        <div className="site-container guest-portal-header-inner">
          <div className="guest-portal-brand-wrap">
            <Brand />
            <span className="guest-portal-badge">{tr("common:guestPortalLayout.guestPortal")}</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="guest-portal-nav" aria-label={tr("common:guestPortalLayout.guestAccountNavigation")}>
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
                  {to.endsWith("/services") && <ServicePaymentBadge count={unpaidServiceOrders.length} />}
                </NavLink>
              );
            })}
          </nav>

          {/* Actions & Profile */}
          <div className="guest-portal-actions"><LanguageSwitcher />
            <LinkButton to="/rooms" variant="secondary" className="guest-portal-explore-btn">
              <Plus size={15} />
              <span>{tr("common:guestPortalLayout.bookAnotherRoom")}</span>
            </LinkButton>

            <div className="guest-portal-user-chip">
              <div className="guest-portal-avatar" aria-hidden="true">
                {firstLetter}
              </div>
              <div className="guest-portal-user-meta">
                <span className="guest-portal-greeting">{tr("common:guestPortalLayout.welcome")}</span>
                <strong className="guest-portal-user-name">{user.fullName || tr("common:guestPortalLayout.dearGuest")}</strong>
              </div>
              <button
                type="button"
                className="guest-portal-logout-icon-btn"
                title={tr("common:guestPortalLayout.signOut")}
                aria-label={tr("common:guestPortalLayout.signOut")}
                onClick={() => setLogoutOpen(true)}
              >
                <LogOut size={16} />
              </button>
            </div>

            <button
              type="button"
              className="guest-portal-mobile-menu-btn icon-button"
              aria-label={tr("common:guestPortalLayout.openMenu")}
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
        title={tr("common:guestPortalLayout.yourWorkspace")}
        className="mobile-navigation"
      >
        <div className="guest-mobile-menu-user-card">
          <div className="guest-portal-avatar large">{firstLetter}</div>
          <div>
            <strong>{user.fullName || tr("common:guestPortalLayout.dearGuest")}</strong>
            <p>{user.email}</p>
          </div>
        </div>
        <nav onClick={() => setMobileMenuOpen(false)}>
          {navLinks.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className="guest-mobile-nav-item">
              <Icon size={18} />
              <span>{label}</span>
                  {to.endsWith("/services") && <ServicePaymentBadge count={unpaidServiceOrders.length} />}
            </Link>
          ))}
          <Link to="/rooms" className="guest-mobile-nav-item highlight">
            <Compass size={18} />
            <span>{tr("common:guestPortalLayout.exploreBook")}</span>
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
            <span>{tr("common:guestPortalLayout.signOut")}</span>
          </button>
        </nav>
      </Dialog>

      {/* Main Content Area */}
      <main id="guest-portal-content" className="guest-portal-main">
        <div className="site-container guest-portal-container">
          <ServicePaymentNotice count={unpaidServiceOrders.length} />
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar for rapid thumb access */}
      <nav className="guest-portal-bottom-bar" aria-label={tr("common:guestPortalLayout.mobileNavigation")}>
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
                  {to.endsWith("/services") && <ServicePaymentBadge count={unpaidServiceOrders.length} />}
            </NavLink>
          );
        })}
      </nav>

      {/* Guest Portal Footer */}
      <footer className="guest-portal-footer">
        <div className="site-container guest-portal-footer-inner">
          <div className="guest-portal-footer-brand">
            <Brand />
            <p>{tr("common:guestPortalLayout.aMomentOfCalmACompleteGetaway")}</p>
          </div>
          <div className="guest-portal-footer-links">
            <Link to="/">{tr("common:guestPortalLayout.hotelHomepage")}</Link>
            <Link to="/rooms">{tr("common:guestPortalLayout.browseRooms")}</Link>
            <a href="tel:19000000" title={tr("common:guestPortalLayout.contactReception247")}>{tr("common:guestPortalLayout.247ReceptionHotline")}</a>
          </div>
          <span className="guest-portal-copyright">{tr("common:guestPortalLayout.valueAnNhienHotelSuitesTopic14", { value0: (new Date().getFullYear()) })}</span>
        </div>
      </footer>

      {/* Logout Confirmation Dialog */}
      <Dialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title={tr("common:guestPortalLayout.signOutOfYourAccount")}
      >
        <p>{tr("common:guestPortalLayout.youWillBeSignedOutOnThisDeviceYouCanSignIn")}</p>
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setLogoutOpen(false)}>{tr("common:guestPortalLayout.staySignedIn")}</Button>
          <Button
            onClick={() => {
              logout();
              toast(() => (tr("common:guestPortalLayout.youHaveSignedOut")));
              navigate('/login', { replace: true });
            }}
          >{tr("common:guestPortalLayout.confirmSignOut")}</Button>
        </div>
      </Dialog>
    </div>
  );
}
