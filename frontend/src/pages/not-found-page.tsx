import { ArrowLeft } from 'lucide-react';
import { LinkButton } from '../components/ui';
export function NotFoundPage() { return <section className="not-found site-container"><span className="not-found-number">404</span><p className="eyebrow">MỘT LỐI RẼ KHÁC</p><h1>Có lẽ bạn đã<br /><em>đi hơi xa.</em></h1><p>Trang bạn đang tìm không tồn tại hoặc đã được chuyển đi.<br />Hãy trở về và bắt đầu một hành trình mới.</p><LinkButton to="/"><ArrowLeft size={18} />Về trang chủ</LinkButton></section>; }
