import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { ArrowUpRight, LayoutDashboard, LogOut, Menu, ShieldCheck, UserRound } from 'lucide-react';
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
  if (!user) return null;
  const home = user.role === 'ADMIN' && location.pathname.startsWith('/reception') ? '/reception' : homeForRole[user.role], features = featuresForRole[user.role];
  const title = location.pathname.includes('/profile') ? 'Hồ sơ cá nhân' : location.pathname.includes('/invoices/') || location.pathname.endsWith('/billing') ? 'Hóa đơn & thanh toán' : features.find(f => location.pathname.includes('/' + f.slug))?.title ?? 'Tổng quan';
  const navigation = <><p className="nav-label">{user.role === 'GUEST' ? 'KHÔNG GIAN CỦA BẠN' : 'KHÔNG GIAN LÀM VIỆC'}</p><nav className="workspace-nav" aria-label="Điều hướng tài khoản" onClick={() => setMobileOpen(false)}><NavLink to={home} end><LayoutDashboard size={19} />Tổng quan</NavLink>{features.map(({ slug, title, icon: Icon }) => <NavLink key={slug} to={`${home}/${slug}`}><Icon size={19} /><span>{title}</span></NavLink>)}<span className="nav-divider" /><NavLink to={`${home}/profile`}><UserRound size={19} />Hồ sơ cá nhân</NavLink></nav></>;
  return <div className={`workspace ${user.role === 'GUEST' ? 'guest-workspace' : 'staff-workspace'}`}><a className="skip-link" href="#main-content">Đến nội dung chính</a><aside className="workspace-sidebar"><Brand light /><div className="sidebar-role">{roleLabel[user.role]}<span>AN NHIÊN HOTEL & SUITES</span></div>{navigation}<div className="sidebar-bottom"><Link to="/"><ArrowUpRight size={17} />Ghé thăm website</Link><button onClick={() => setLogoutOpen(true)}><LogOut size={17} />Đăng xuất</button><div className="sidebar-user"><span>{user.fullName.slice(0, 1).toUpperCase()}</span><div><strong>{user.fullName}</strong><small>{roleLabel[user.role]}</small></div></div></div></aside><div className="workspace-main"><header className="workspace-topbar"><div><button className="mobile-menu icon-button" aria-label="Mở menu tài khoản" onClick={() => setMobileOpen(true)}><Menu /></button><span>An Nhiên <span className="breadcrumb-slash">/</span><strong>{title}</strong></span></div><div><StatusBadge tone="success">Đã xác thực</StatusBadge><Link to={`${home}/profile`} className="topbar-avatar" aria-label="Xem hồ sơ cá nhân">{user.fullName.slice(0, 1).toUpperCase()}</Link><button className="icon-button topbar-logout" aria-label="Đăng xuất" onClick={() => setLogoutOpen(true)}><LogOut size={18} /></button></div></header><main id="main-content" className="workspace-content"><PendingReceiptNotice userId={user.id} home={home} enabled={user.role === 'ADMIN' || user.role === 'RECEPTIONIST'} /><Outlet /></main><footer className="workspace-footer"><span>© {new Date().getFullYear()} An Nhiên Hotel & Suites</span><span>Chăm chút từng trải nghiệm.</span></footer></div>
    <Dialog open={mobileOpen} onClose={() => setMobileOpen(false)} title="Không gian của bạn" className="workspace-mobile-dialog">{navigation}<Button variant="secondary" onClick={() => { setMobileOpen(false); setLogoutOpen(true); }}><LogOut size={17} />Đăng xuất</Button></Dialog>
    <Dialog open={logoutOpen} onClose={() => setLogoutOpen(false)} title="Đăng xuất tài khoản?"><div className="dialog-icon"><ShieldCheck size={29} /></div><p>Bạn sẽ đăng xuất khỏi tab này. Lần truy cập tiếp theo cần đăng nhập lại.</p><div className="dialog-actions"><Button variant="secondary" onClick={() => setLogoutOpen(false)}>Ở lại</Button><Button onClick={() => { logout(); toast('Đã đăng xuất trên thiết bị này.'); navigate('/login', { replace: true }); }}>Xác nhận đăng xuất</Button></div></Dialog>
  </div>;
}

function PendingReceiptNotice({ userId, home, enabled }: { userId: string; home: string; enabled: boolean }) {
  if (!enabled) return null;
  let attempt; let failed = false;
  try { attempt = readAttempt(userId); } catch { failed = true; }
  if (failed) return <p className="form-error" role="alert">Không đọc được thông tin khoản thu chờ kiểm tra trong phiên trình duyệt.</p>;
  return attempt ? <p className="notice">Có khoản thu cần đối chiếu. <Link to={`${home}/invoices/${attempt.invoiceId}`}>Mở hóa đơn cần kiểm tra</Link></p> : null;
}
