import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  ArrowUpRight,
  BedDouble,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coffee,
  HeartHandshake,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Tag,
  Users,
  Wifi,
} from 'lucide-react';
import { LinkButton } from '../components/ui';
import { SearchForm, Skeleton } from '../features/guest/components';
import { money, type RoomType } from '../features/guest/contracts';
import { useRoomTypes } from '../features/guest/queries';

function getRoomTypeImage(typeName: string): string {
  const lower = typeName.toLowerCase();
  if (lower.includes('suite')) return '/images/suite.jpg';
  if (lower.includes('deluxe') || lower.includes('retreat')) return '/images/retreat.jpg';
  return '/images/hero.jpg';
}

export function HomePage() {
  const types = useRoomTypes();
  const [guestFilter, setGuestFilter] = useState<'ALL' | 'COUPLE' | 'FAMILY'>('ALL');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Tính toán ngày nhận phòng (hôm nay) và ngày trả phòng (ngày mai) theo múi giờ Việt Nam
  const today = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }, []);

  const tomorrow = useMemo(() => {
    return new Date(Date.parse(today + 'T00:00:00Z') + 86400000)
      .toISOString()
      .slice(0, 10);
  }, [today]);

  const roomTypesList: RoomType[] = types.data ?? [];

  // Lọc hạng phòng theo số lượng khách
  const filteredTypes = useMemo(() => {
    if (guestFilter === 'COUPLE') {
      return roomTypesList.filter((t) => t.maxGuests <= 2);
    }
    if (guestFilter === 'FAMILY') {
      return roomTypesList.filter((t) => t.maxGuests > 2);
    }
    return roomTypesList;
  }, [roomTypesList, guestFilter]);

  // Tìm mức giá thấp nhất để hiển thị khuyến mãi
  const lowestPrice = useMemo(() => {
    if (!roomTypesList.length) return null;
    return roomTypesList.reduce((prev, curr) => {
      const prevVal = Number(prev.nightlyPrice) || 0;
      const currVal = Number(curr.nightlyPrice) || 0;
      return currVal < prevVal ? curr : prev;
    }, roomTypesList[0]);
  }, [roomTypesList]);

  const faqs = [
    {
      q: 'Giờ nhận phòng (Check-in) và trả phòng (Check-out) là mấy giờ?',
      a: 'Khách sạn hỗ trợ nhận phòng từ 14:00 và trả phòng trước 12:00 trưa hôm sau. Chúng tôi luôn sẵn lòng hỗ trợ nhận sớm hoặc trả trễ miễn phí tùy tình trạng phòng thực tế, kèm giữ hành lý an toàn tại quầy lễ tân.',
    },
    {
      q: 'Tôi có cần thanh toán tiền ngay khi đặt phòng trực tuyến không?',
      a: 'Quý khách có thể lựa chọn thanh toán linh hoạt: chuyển khoản qua mã QR ngân hàng VietQR hoặc thanh toán trực tiếp bằng tiền mặt / thẻ khi làm thủ tục check-in tại quầy lễ tân.',
    },
    {
      q: 'Chính sách đổi ngày hoặc hủy đặt phòng tại An Nhiên như thế nào?',
      a: 'Khi đặt phòng trực tiếp qua website, quý khách được hỗ trợ đổi ngày lưu trú hoặc hủy phòng hoàn toàn miễn phí trước 24 giờ so với giờ nhận phòng tiêu chuẩn mà không phát sinh chi phí.',
    },
    {
      q: 'Giá phòng trên website đã bao gồm thuế phí và các tiện ích chưa?',
      a: 'Tất cả mức giá hiển thị đều là giá trọn gói niêm yết minh bạch, đã bao gồm thuế VAT, phí phục vụ, nước suối đóng chai, trà thảo mộc đón tiếp và wifi tốc độ cao trong suốt kỳ lưu trú.',
    },
    {
      q: 'Tôi muốn đặt phòng cho đoàn đông hoặc có yêu cầu riêng thì làm thế nào?',
      a: 'Quý khách có thể liên hệ trực tiếp với bộ phận lễ tân qua hotline 0987 654 321 hoặc để lại ghi chú khi đặt phòng. Đội ngũ An Nhiên sẽ sắp xếp phòng gần nhau và chuẩn bị tiện ích phù hợp nhất cho đoàn của bạn.',
    },
  ];

  return (
    <div className="home-booking-experience">
      {/* 1. HERO VỚI FLOATING BOOKING HUB */}
      <section className="hero home-hero">
        <img
          className="hero-image"
          src="/images/hero.jpg"
          alt="Không gian An Nhiên Hotel sang trọng và thanh bình"
          width="2000"
          height="1333"
          fetchPriority="high"
        />
        <div className="hero-shade" />

        <div className="site-container hero-content">
          <div className="hero-rating-badge">
            ✦ 4.9/5 · Trải nghiệm nghỉ dưỡng được yêu thích
          </div>
          <p className="eyebrow light">
            <span />
            ĐẶT PHÒNG TRỰC TIẾP · AN NHIÊN BOUTIQUE HOTEL
          </p>
          <h1>
            Một khoảng lặng,
            <br />
            một kỳ nghỉ <em>trọn vẹn.</em>
          </h1>
          <p className="hero-description">
            Gác lại nhịp sống vội vàng để tận hưởng không gian thanh bình tại An Nhiên.
            Đặt phòng trực tiếp ngay hôm nay để nhận giá ưu đãi tốt nhất cùng đặc quyền đón tiếp chu đáo.
          </p>
        </div>
      </section>

      {/* Floating Booking Engine */}
      <section className="hero-booking-wrapper site-container" aria-label="Tìm kiếm và đặt phòng">
        <div className="hero-booking-card">
          <div className="booking-card-header">
            <div>
              <span className="booking-card-kicker">KỲ NGHỈ CỦA BẠN</span>
              <h2 className="booking-card-title">Tìm phòng sẵn sàng đón tiếp</h2>
            </div>
            <span className="booking-card-badge">
              <Sparkles size={14} /> Giữ giá niêm yết tốt nhất
            </span>
          </div>

          <SearchForm
            initial={{ checkIn: today, checkOut: tomorrow, guests: 2 }}
            roomTypes={roomTypesList}
          />

          <div className="hero-trust-bar">
            <span className="trust-item">
              <CheckCircle2 size={15} /> Xác nhận tức thì qua hệ thống
            </span>
            <span className="trust-item">
              <ShieldCheck size={15} /> Miễn phí hủy trước 24 giờ
            </span>
            <span className="trust-item">
              <Tag size={15} /> Không phí đặt phòng ẩn
            </span>
            <span className="trust-item">
              <Coffee size={15} /> Tặng trà thảo mộc chào mừng
            </span>
          </div>
        </div>
      </section>

      {/* 2. DIRECT BOOKING PERKS - ĐẶC QUYỀN ĐẶT TRỰC TIẾP */}
      <section className="direct-perks-section site-container" aria-label="Đặc quyền khi đặt phòng trực tiếp">
        <div className="section-heading text-center">
          <div>
            <p className="eyebrow">ƯU ĐÃI ĐẶC QUYỀN</p>
            <h2>
              Lý do nên đặt phòng <em>trực tiếp</em> tại An Nhiên
            </h2>
          </div>
          <p>
            Đặt phòng ngay tại website chính thức để tận hưởng trọn vẹn những ưu đãi độc quyền mà các kênh trung gian không có.
          </p>
        </div>

        <div className="perks-grid">
          <article className="perk-card">
            <div className="perk-icon-wrap">
              <Tag size={26} strokeWidth={1.5} />
            </div>
            <span className="perk-badge">Tiết kiệm 5-10%</span>
            <h3>Cam kết giá tốt nhất</h3>
            <p>
              Giá niêm yết trực tiếp luôn là mức giá ưu đãi nhất. Không qua trung gian, không phát sinh phụ phí ẩn khi nhận phòng.
            </p>
          </article>

          <article className="perk-card">
            <div className="perk-icon-wrap">
              <Coffee size={26} strokeWidth={1.5} />
            </div>
            <span className="perk-badge">Miễn phí 100%</span>
            <h3>Trà & Cà phê đón tiếp</h3>
            <p>
              Thưởng thức trà thảo mộc An Nhiên và cà phê thượng hạng phục vụ chu đáo ngay khi làm thủ tục check-in.
            </p>
          </article>

          <article className="perk-card">
            <div className="perk-icon-wrap">
              <Clock size={26} strokeWidth={1.5} />
            </div>
            <span className="perk-badge">Ưu tiên số 1</span>
            <h3>Linh hoạt giờ nhận phòng</h3>
            <p>
              Ưu tiên hỗ trợ nhận phòng sớm hoặc trả phòng trễ khi khách sạn có phòng trống sẵn sàng, kèm dịch vụ giữ hành lý an toàn.
            </p>
          </article>

          <article className="perk-card">
            <div className="perk-icon-wrap">
              <HeartHandshake size={26} strokeWidth={1.5} />
            </div>
            <span className="perk-badge">An tâm tuyệt đối</span>
            <h3>Đổi ngày & Hủy linh hoạt</h3>
            <p>
              Kế hoạch thay đổi? Dễ dàng đổi ngày hoặc hủy phòng hoàn toàn miễn phí trước 24 giờ. Đội ngũ hỗ trợ 24/7.
            </p>
          </article>
        </div>
      </section>

      {/* 3. LIVE ROOM SHOWCASE - DANH SÁCH HẠNG PHÒNG THỰC TẾ & ĐẶT NGAY */}
      <section className="live-rooms-section" id="khong-gian">
        <div className="site-container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">BỘ SƯU TẬP HẠNG PHÒNG</p>
              <h2>
                Không gian nghỉ ngơi <em>dành cho bạn.</em>
              </h2>
            </div>
            <Link to="/rooms" className="text-link">
              Xem tất cả phòng & lịch trống <ArrowUpRight size={18} />
            </Link>
          </div>

          {/* Quick Filter Tabs */}
          <div className="room-filter-tabs" role="tablist" aria-label="Lọc theo nhu cầu nghỉ dưỡng">
            <button
              type="button"
              className={`filter-tab-btn ${guestFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setGuestFilter('ALL')}
            >
              Tất cả hạng phòng ({roomTypesList.length})
            </button>
            <button
              type="button"
              className={`filter-tab-btn ${guestFilter === 'COUPLE' ? 'active' : ''}`}
              onClick={() => setGuestFilter('COUPLE')}
            >
              Cặp đôi & 1-2 khách
            </button>
            <button
              type="button"
              className={`filter-tab-btn ${guestFilter === 'FAMILY' ? 'active' : ''}`}
              onClick={() => setGuestFilter('FAMILY')}
            >
              Gia đình & Nhóm (3+ khách)
            </button>
          </div>

          {types.isPending ? (
            <Skeleton />
          ) : (
            <div className="live-rooms-grid">
              {filteredTypes.map((type) => {
                const bookUrl = `/rooms?roomTypeId=${type.id}&checkIn=${today}&checkOut=${tomorrow}&guests=${Math.min(2, type.maxGuests)}`;
                return (
                  <article className="showcase-room-card" key={type.id}>
                    <div className="showcase-media">
                      <img
                        src={getRoomTypeImage(type.name)}
                        alt={`Hạng phòng ${type.name} tại An Nhiên Hotel`}
                        loading="lazy"
                      />
                      <div className="showcase-media-overlay">
                        <span className="room-capacity-badge">
                          <Users size={13} /> Tối đa {type.maxGuests} khách
                        </span>
                        <span className="room-highlight-chip">✦ Sẵn sàng đón tiếp</span>
                      </div>
                    </div>

                    <div className="showcase-body">
                      <div className="showcase-header">
                        <div>
                          <h3 className="showcase-title">{type.name}</h3>
                          <p className="showcase-subtitle">Không gian an nhiên · Ban công đón sáng</p>
                        </div>
                        <div className="showcase-price-box">
                          <span className="price-number">{money(type.nightlyPrice)}</span>
                          <span className="price-unit">/ đêm</span>
                        </div>
                      </div>

                      <p className="showcase-desc">
                        {type.description ||
                          'Phòng nghỉ với thiết kế mộc mạc, chan hòa ánh sáng và trang bị đầy đủ tiện nghi tiêu chuẩn cho kỳ nghỉ thảnh thơi.'}
                      </p>

                      <div className="showcase-specs">
                        <span className="spec-item">
                          <BedDouble size={14} /> Giường nệm cao cấp
                        </span>
                        <span className="spec-item">
                          <Wifi size={14} /> Wifi tốc độ cao
                        </span>
                        <span className="spec-item">
                          <Coffee size={14} /> Trà & Nước suối miễn phí
                        </span>
                      </div>

                      <div className="showcase-actions">
                        <LinkButton
                          to={`/rooms?roomTypeId=${type.id}`}
                          variant="secondary"
                          className="btn-details"
                        >
                          Xem chi tiết phòng
                        </LinkButton>
                        <LinkButton
                          to={bookUrl}
                          variant="primary"
                          className="btn-book-now"
                        >
                          Đặt phòng này <ArrowRight size={16} />
                        </LinkButton>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div className="live-rooms-footer">
            <LinkButton to="/rooms" variant="secondary" className="btn-explore-all">
              Khám phá toàn bộ phòng còn trống hôm nay <ArrowRight size={17} />
            </LinkButton>
          </div>
        </div>
      </section>

      {/* 4. QUY TRÌNH 3 BƯỚC ĐẶT PHÒNG NHANH CHÓNG */}
      <section className="booking-steps-section site-container" aria-label="Quy trình đặt phòng">
        <div className="section-heading text-center">
          <div>
            <p className="eyebrow">QUY TRÌNH THUẬN TIỆN</p>
            <h2>
              Đặt phòng đơn giản chỉ trong <em>3 bước</em>
            </h2>
          </div>
          <p>Trải nghiệm đặt phòng trực tuyến thông minh, minh bạch và nhanh chóng.</p>
        </div>

        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">01</div>
            <div className="step-icon">
              <CalendarCheck size={28} strokeWidth={1.4} />
            </div>
            <h4>Chọn ngày & Hạng phòng</h4>
            <p>Nhập ngày nhận/trả phòng và số lượng khách để xem danh sách phòng sẵn sàng.</p>
          </div>

          <div className="step-card">
            <div className="step-number">02</div>
            <div className="step-icon">
              <ShieldCheck size={28} strokeWidth={1.4} />
            </div>
            <h4>Xác nhận thông tin</h4>
            <p>Điền thông tin liên hệ chỉ trong 60 giây. Không yêu cầu thẻ tín dụng phức tạp.</p>
          </div>

          <div className="step-card">
            <div className="step-number">03</div>
            <div className="step-icon">
              <Sparkles size={28} strokeWidth={1.4} />
            </div>
            <h4>Nhận phòng & Tận hưởng</h4>
            <p>Nhận mã đặt phòng tức thì qua hệ thống. Thanh toán linh hoạt khi làm thủ tục check-in.</p>
          </div>
        </div>
      </section>

      {/* 5. BOOKING FAQ - GIẢI TỎA THẮC MẮC CỦA KHÁCH HÀNG */}
      <section className="booking-faq-section site-container" aria-label="Câu hỏi thường gặp về đặt phòng">
        <div className="faq-layout">
          <div className="faq-intro">
            <div className="intro-marker">
              <span className="small-star">✳</span>
              <p className="eyebrow">HỖ TRỢ ĐẶT PHÒNG</p>
            </div>
            <h2>
              Những thắc mắc
              <br />
              thường gặp của <em>khách hàng</em>
            </h2>
            <p>
              Chúng tôi luôn minh bạch mọi thông tin để bạn có kỳ nghỉ trọn vẹn và an tâm nhất từ lúc bắt đầu đặt phòng.
            </p>
            <div className="faq-support-card">
              <div className="support-icon">
                <PhoneCall size={22} />
              </div>
              <div>
                <strong>Cần hỗ trợ tư vấn gấp?</strong>
                <p>Hotline lễ tân 24/7: 0987 654 321</p>
              </div>
            </div>
          </div>

          <div className="faq-accordion-list">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <article
                  key={faq.q}
                  className={`faq-item ${isOpen ? 'is-open' : ''}`}
                >
                  <button
                    type="button"
                    className="faq-question-btn"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    aria-expanded={isOpen}
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      size={20}
                      className={`faq-arrow ${isOpen ? 'rotate' : ''}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="faq-answer-body">
                      <p>{faq.a}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6. CALL TO ACTION - CHỐT ĐƠN CUỐI TRANG */}
      <section className="membership-section booking-cta-section">
        <div className="site-container membership-inner">
          <div>
            <p className="eyebrow light">KỲ NGHỈ THẢNH THƠI</p>
            <h2>
              Sẵn sàng cho chuyến
              <br />
              đi tiếp theo của <em>bạn?</em>
            </h2>
          </div>
          <div>
            <p>
              Đội ngũ An Nhiên Hotel đã sẵn sàng đón tiếp. Đặt phòng trực tiếp ngay hôm nay để nhận mức giá ưu đãi nhất
              {lowestPrice ? ` (chỉ từ ${money(lowestPrice.nightlyPrice)}/đêm)` : ''}.
            </p>
            <div className="cta-actions-group">
              <LinkButton to="/rooms" variant="light">
                Xem phòng & Đặt ngay <ArrowRight size={18} />
              </LinkButton>
              <LinkButton to="/register" variant="secondary">
                Tạo tài khoản hội viên
              </LinkButton>
            </div>
          </div>
        </div>
      </section>

      {/* 7. STICKY MOBILE BOOKING BAR - DÀNH CHO ĐIỆN THOẠI */}
      <aside className="mobile-sticky-booking-bar" aria-label="Đặt phòng nhanh">
        <div className="mobile-sticky-content">
          <div className="mobile-sticky-price">
            <span className="price-label">Giá chỉ từ</span>
            <strong>{lowestPrice ? money(lowestPrice.nightlyPrice) : '650.000 ₫'}</strong>
            <small>/ đêm</small>
          </div>
          <LinkButton to="/rooms" variant="primary" className="mobile-sticky-cta">
            Đặt phòng ngay <ArrowRight size={15} />
          </LinkButton>
        </div>
      </aside>
    </div>
  );
}
