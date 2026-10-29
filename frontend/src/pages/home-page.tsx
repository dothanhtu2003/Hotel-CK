import { useState } from 'react';
import { SearchForm } from '../features/guest/components';
import { useRoomTypes } from '../features/guest/queries';
import { Link } from 'react-router';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Leaf,
  MapPin,
  Sparkles,
  Sun,
  Waves,
} from 'lucide-react';
import {
  Button,
  Dialog,
  LinkButton,
  RoomCard,
  StatusBadge,
} from '../components/ui';

export function HomePage() {
  const [details, setDetails] = useState(false);
  const types = useRoomTypes();
  return (
    <>
      <section className="hero">
        <img
          className="hero-image"
          src="/images/hero.jpg"
          alt="Không gian khách sạn với hồ bơi xanh trong, ghế nghỉ và những tán cọ"
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
            CHẠM VÀO SỰ THẢNH THƠI
          </p>
          <h1>
            Một khoảng lặng,
            <br />
            một kỳ nghỉ <em>trọn vẹn.</em>
          </h1>
          <p className="hero-description">
            Gác lại nhịp sống vội vàng. Để từng khoảnh khắc tại
            <br className="desktop-break" /> An Nhiên trở thành một trải nghiệm
            đáng nhớ.
          </p>
          <LinkButton to="/rooms" variant="light">
            Bắt đầu hành trình <ArrowUpRight size={19} />
          </LinkButton>
          <a className="hero-discover" href="#khong-gian">
            <span>KHÁM PHÁ AN NHIÊN</span>
            <ArrowDown size={19} />
          </a>
        </div>
        <div className="hero-side-label">AN NHIÊN · STAY A LITTLE LONGER</div>
      </section>

      <SearchForm compact />

      {/* Hotel Highlights bar */}
      <section className="site-container hotel-highlights">
        <div className="highlight-item">
          <strong>100%</strong>
          <span>Phòng đón sáng tự nhiên</span>
        </div>
        <div className="highlight-item">
          <strong>24/7</strong>
          <span>Đội ngũ phục vụ tận tâm</span>
        </div>
        <div className="highlight-item">
          <strong>Miễn phí</strong>
          <span>Trà thảo mộc & Cà phê đón tiếp</span>
        </div>
        <div className="highlight-item">
          <strong>Linh hoạt</strong>
          <span>Nhận & trả phòng thuận tiện</span>
        </div>
      </section>

      <section className="site-container introduction" id="ve-an-nhien">
        <div className="intro-marker">
          <span className="small-star">✳</span>
          <p className="eyebrow">CHÀO MỪNG ĐẾN AN NHIÊN</p>
        </div>
        <div>
          <h2>
            Nơi những điều giản đơn
            <br />
            trở nên <em>đặc biệt.</em>
          </h2>
          <p>
            Một không gian đủ yên để nghỉ ngơi, đủ ấm áp để cảm thấy thuộc về.
            Chúng tôi chăm chút từng chi tiết, để bạn chỉ cần tận hưởng kỳ nghỉ
            theo cách của riêng mình.
          </p>
          <a href="#trai-nghiem" className="text-link">
            Cảm nhận sự khác biệt <ArrowUpRight size={18} />
          </a>
        </div>
        <div className="intro-note">
          <Leaf strokeWidth={1} size={35} />
          <span>
            CHẬM LẠI MỘT CHÚT.
            <br />
            TẬN HƯỞNG NHIỀU HƠN.
          </span>
        </div>
      </section>

      <section className="spaces-section" id="khong-gian">
        <div className="site-container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">KHÔNG GIAN LƯU TRÚ</p>
              <h2>
                Thức dậy giữa <em>an nhiên.</em>
              </h2>
            </div>
            <p>
              Ánh sáng tự nhiên, chất liệu ấm áp
              <br />
              và những khoảng riêng thật dễ chịu.
            </p>
          </div>
          <div className="rooms-grid">
            <RoomCard
              image="/images/suite.jpg"
              name="Một giấc ngủ thật sâu"
              description="Không gian thoáng đãng · Chất liệu tự nhiên"
              onExplore={() => setDetails(true)}
            />
            <RoomCard
              image="/images/retreat.jpg"
              name="Một khoảng riêng thư thái"
              description="Ánh sáng dịu nhẹ · Tinh thần nghỉ dưỡng"
              onExplore={() => setDetails(true)}
            />
          </div>
          <p className="editorial-note">
            Hình ảnh giới thiệu phong cách. Xem loại phòng và giá hiện tại từ hệ
            thống bên dưới.
          </p>
          <div className="guest-type-links">
            {types.data?.map((t) => (
              <Link
                className="button button-secondary"
                key={t.id}
                to="/rooms"
              >
                {t.name} · Tối đa {t.maxGuests} khách
              </Link>
            ))}
            <Link className="button button-primary" to="/rooms">
              Xem tất cả phòng
            </Link>
          </div>
        </div>
      </section>

      <section className="site-container experiences" id="trai-nghiem">
        <div className="section-heading">
          <div>
            <p className="eyebrow">NHỮNG ĐIỀU NHỎ BÉ, ĐÁNG NHỚ</p>
            <h2>
              Kỳ nghỉ theo <em>nhịp của bạn.</em>
            </h2>
          </div>
          <Sparkles size={28} strokeWidth={1} />
        </div>
        <div className="experience-grid">
          {[
            {
              icon: Sun,
              title: 'Buổi sáng thật chậm',
              text: 'Đón ánh nắng, nhâm nhi một tách cà phê và để ngày mới bắt đầu nhẹ nhàng.',
            },
            {
              icon: Waves,
              title: 'Khoảnh khắc thảnh thơi',
              text: 'Tìm lại sự cân bằng trong những khoảng nghỉ dành riêng cho bản thân.',
            },
            {
              icon: MapPin,
              title: 'Những khám phá mới',
              text: 'Bước ra ngoài, cảm nhận nhịp sống địa phương và mang về câu chuyện của bạn.',
            },
          ].map(({ icon: Icon, title, text }, index) => (
            <article key={title}>
              <div>
                <Icon size={27} strokeWidth={1.3} />
                <span>0{index + 1}</span>
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="membership-section">
        <div className="site-container membership-inner">
          <div>
            <p className="eyebrow light">MỖI HÀNH TRÌNH, MỘT KẾT NỐI</p>
            <h2>
              Kỳ nghỉ tiếp theo,
              <br />
              bắt đầu từ <em>hôm nay.</em>
            </h2>
          </div>
          <div>
            <p>
              Tạo tài khoản để chuẩn bị cho những hành trình sắp tới và quản lý
              thông tin cá nhân thuận tiện hơn.
            </p>
            <LinkButton to="/register" variant="light">
              Trở thành khách của An Nhiên <ArrowRight size={18} />
            </LinkButton>
          </div>
        </div>
      </section>

      <Dialog
        open={details}
        onClose={() => setDetails(false)}
        title="Không gian cảm hứng"
      >
        <StatusBadge>Ảnh minh họa</StatusBadge>
        <p>
          Đây là hình ảnh giới thiệu phong cách An Nhiên. Ảnh minh họa không thay
          thế thông tin của từng phòng. Bạn có thể xem danh mục phòng và tìm theo
          ngày lưu trú.
        </p>
        <LinkButton to="/rooms">Xem danh mục phòng</LinkButton>
        <Button variant="ghost" onClick={() => setDetails(false)}>
          Đóng
        </Button>
      </Dialog>
    </>
  );
}
