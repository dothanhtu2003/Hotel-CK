import { catalogName, catalogDescription } from "../i18n/catalog";
import { t as tr, useLocale } from "../i18n";
import { Trans } from "react-i18next";
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
  const locale = useLocale();
  const types = useRoomTypes();
  const [guestFilter, setGuestFilter] = useState<'ALL' | 'COUPLE' | 'FAMILY'>('ALL');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Tính toán ngày nhận phòng (hôm nay) và ngày trả phòng (ngày mai) theo múi giờ Việt Nam
  const today = useMemo(() => {
    void locale; // Recompute presentation when the language changes.

    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }, [locale]);

  const tomorrow = useMemo(() => {
    void locale; // Recompute presentation when the language changes.

    return new Date(Date.parse(today + 'T00:00:00Z') + 86400000)
      .toISOString()
      .slice(0, 10);
  }, [today, locale]);

  const roomTypesList: RoomType[] = useMemo(() => types.data ?? [], [types.data]);

  // Lọc hạng phòng theo số lượng khách
  const filteredTypes = useMemo(() => {
    void locale; // Recompute presentation when the language changes.

    if (guestFilter === 'COUPLE') {
      return roomTypesList.filter((t) => t.maxGuests <= 2);
    }
    if (guestFilter === 'FAMILY') {
      return roomTypesList.filter((t) => t.maxGuests > 2);
    }
    return roomTypesList;
  }, [roomTypesList, guestFilter, locale]);

  // Tìm mức giá thấp nhất để hiển thị khuyến mãi
  const lowestPrice = useMemo(() => {
    void locale; // Recompute presentation when the language changes.

    if (!roomTypesList.length) return null;
    return roomTypesList.reduce((prev, curr) => {
      const prevVal = Number(prev.nightlyPrice) || 0;
      const currVal = Number(curr.nightlyPrice) || 0;
      return currVal < prevVal ? curr : prev;
    }, roomTypesList[0]);
  }, [roomTypesList, locale]);

  const faqs = [
    {
      q: tr("guest:homePage.whatAreTheCheckInAndCheckOutTimes"),
      a: tr("guest:homePage.checkInStartsAt1400AndCheckOutIsBefore12"),
    },
    {
      q: tr("guest:homePage.doINeedToPayWhenBookingOnline"),
      a: tr("guest:homePage.youCanChooseFlexiblePaymentBankTransferUsingAVietqrCodeOr"),
    },
    {
      q: tr("guest:homePage.whatIsTheDateChangeOrCancellationPolicyAtAnNhien"),
      a: tr("guest:homePage.whenBookingDirectlyThroughOurWebsiteYouCanChangeYourStayDates"),
    },
    {
      q: tr("guest:homePage.doWebsiteRoomRatesIncludeTaxesFeesAndAmenities"),
      a: tr("guest:homePage.allDisplayedRatesAreTransparentAllInclusivePricesWithVatServiceCharges"),
    },
    {
      q: tr("guest:homePage.howDoIBookForALargeGroupOrMakeSpecialRequests"),
      a: tr("guest:homePage.contactReceptionOn0987654321OrLeaveANoteWhenBooking"),
    },
  ];

  return (
    <div className="home-booking-experience">
      {/* 1. HERO VỚI FLOATING BOOKING HUB */}
      <section className="hero home-hero">
        <img
          className="hero-image"
          src="/images/hero.jpg"
          alt={tr("guest:homePage.theElegantAndTranquilAnNhienHotel")}
          width="2000"
          height="1333"
          fetchPriority="high"
        />
        <div className="hero-shade" />

        <div className="site-container hero-content">
          <div className="hero-rating-badge">{tr("guest:homePage.495AMuchLovedGetawayExperience")}</div>
          <p className="eyebrow light">
            <span />
            {tr("guest:homePage.bookDirectAnNhienBoutiqueHotel")}</p>
          <h1><Trans ns="guest" i18nKey="homePage.aMomentOfCalmACompleteGetaway" components={{ part0: <br />, part1: <em /> }} /></h1>
          <p className="hero-description">{tr("guest:homePage.setTheBusyWorldAsideAndEnjoyTheTranquilityOfAnNhien")}</p>
        </div>
      </section>

      {/* Floating Booking Engine */}
      <section className="hero-booking-wrapper site-container" aria-label={tr("guest:homePage.searchAndBookRooms")}>
        <div className="hero-booking-card">
          <div className="booking-card-header">
            <div>
              <span className="booking-card-kicker">{tr("guest:components.yourGetaway")}</span>
              <h2 className="booking-card-title">{tr("guest:homePage.findRoomsReadyToWelcomeYou")}</h2>
            </div>
            <span className="booking-card-badge">
              <Sparkles size={14} /> {tr("guest:homePage.bestPublishedRate")}</span>
          </div>

          <SearchForm
            initial={{ checkIn: today, checkOut: tomorrow, guests: 2 }}
            roomTypes={roomTypesList}
          />

          <div className="hero-trust-bar">
            <span className="trust-item">
              <CheckCircle2 size={15} /> {tr("guest:homePage.instantSystemConfirmation")}</span>
            <span className="trust-item">
              <ShieldCheck size={15} /> {tr("guest:homePage.freeCancellationUpTo24HoursBeforeArrival")}</span>
            <span className="trust-item">
              <Tag size={15} /> {tr("guest:homePage.noHiddenBookingFees")}</span>
            <span className="trust-item">
              <Coffee size={15} /> {tr("guest:homePage.complimentaryWelcomeHerbalTea")}</span>
          </div>
        </div>
      </section>

      {/* 2. DIRECT BOOKING PERKS - ĐẶC QUYỀN ĐẶT TRỰC TIẾP */}
      <section className="direct-perks-section site-container" aria-label={tr("guest:homePage.directBookingBenefits")}>
        <div className="section-heading text-center">
          <div>
            <p className="eyebrow">{tr("guest:homePage.exclusiveBenefits")}</p>
            <h2><Trans ns="guest" i18nKey="homePage.whyBookDirectlyWithAnNhien" components={{ part0: <em /> }} /></h2>
          </div>
          <p>{tr("guest:homePage.bookThroughOurOfficialWebsiteToEnjoyExclusiveBenefitsUnavailableThroughIntermediaries")}</p>
        </div>

        <div className="perks-grid">
          <article className="perk-card">
            <div className="perk-icon-wrap">
              <Tag size={26} strokeWidth={1.5} />
            </div>
            <span className="perk-badge">{tr("guest:homePage.save510")}</span>
            <h3>{tr("guest:homePage.bestRateGuarantee")}</h3>
            <p>{tr("guest:homePage.ourDirectRatesOfferTheBestValueNoIntermediariesAndNoHidden")}</p>
          </article>

          <article className="perk-card">
            <div className="perk-icon-wrap">
              <Coffee size={26} strokeWidth={1.5} />
            </div>
            <span className="perk-badge">{tr("guest:homePage.100Complimentary")}</span>
            <h3>{tr("guest:homePage.welcomeTeaCoffee")}</h3>
            <p>{tr("guest:homePage.enjoyAnNhienHerbalTeaAndPremiumCoffeeServedWithCareWhen")}</p>
          </article>

          <article className="perk-card">
            <div className="perk-icon-wrap">
              <Clock size={26} strokeWidth={1.5} />
            </div>
            <span className="perk-badge">{tr("guest:homePage.firstPriority")}</span>
            <h3>{tr("guest:homePage.flexibleCheckIn")}</h3>
            <p>{tr("guest:homePage.priorityAssistanceWithEarlyCheckInOrLateCheckOutWhenRooms")}</p>
          </article>

          <article className="perk-card">
            <div className="perk-icon-wrap">
              <HeartHandshake size={26} strokeWidth={1.5} />
            </div>
            <span className="perk-badge">{tr("guest:homePage.completePeaceOfMind")}</span>
            <h3>{tr("guest:homePage.flexibleDateChangesCancellation")}</h3>
            <p>{tr("guest:homePage.plansChangedChangeDatesOrCancelFreeOfChargeUpTo24")}</p>
          </article>
        </div>
      </section>

      {/* 3. LIVE ROOM SHOWCASE - DANH SÁCH HẠNG PHÒNG THỰC TẾ & ĐẶT NGAY */}
      <section className="live-rooms-section" id="khong-gian">
        <div className="site-container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{tr("guest:homePage.roomCollection")}</p>
              <h2><Trans ns="guest" i18nKey="homePage.aRelaxingSpaceForYou" components={{ part0: <em /> }} /></h2>
            </div>
            <Link to="/rooms" className="text-link">
              {tr("guest:homePage.viewAllRoomsAvailability")}<ArrowUpRight size={18} />
            </Link>
          </div>

          {/* Quick Filter Tabs */}
          <div className="room-filter-tabs" role="tablist" aria-label={tr("guest:homePage.filterByYourGetawayNeeds")}>
            <button
              type="button"
              className={`filter-tab-btn ${guestFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setGuestFilter('ALL')}
            >{tr("guest:homePage.allRoomTypesValue", { value0: (roomTypesList.length) })}</button>
            <button
              type="button"
              className={`filter-tab-btn ${guestFilter === 'COUPLE' ? 'active' : ''}`}
              onClick={() => setGuestFilter('COUPLE')}
            >{tr("guest:homePage.couples12Guests")}</button>
            <button
              type="button"
              className={`filter-tab-btn ${guestFilter === 'FAMILY' ? 'active' : ''}`}
              onClick={() => setGuestFilter('FAMILY')}
            >{tr("guest:homePage.familiesGroups3Guests")}</button>
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
                        alt={tr("guest:homePage.valueRoomTypeAtAnNhienHotel", { value0: (catalogName(type.name)) })}
                        loading="lazy"
                      />
                      <div className="showcase-media-overlay">
                        <span className="room-capacity-badge">
                          <Users size={13} /> {tr("common:supplement.maximumGuests", { value0: type.maxGuests })}</span>
                        <span className="room-highlight-chip">{tr("guest:homePage.readyToWelcomeYou")}</span>
                      </div>
                    </div>

                    <div className="showcase-body">
                      <div className="showcase-header">
                        <div>
                          <h3 className="showcase-title">{catalogName(type.name)}</h3>
                          <p className="showcase-subtitle">{tr("guest:homePage.aPeacefulSpaceSunlitBalcony")}</p>
                        </div>
                        <div className="showcase-price-box">
                          <span className="price-number">{money(type.nightlyPrice)}</span>
                          <span className="price-unit">{tr("guest:homePage.night")}</span>
                        </div>
                      </div>

                      <p className="showcase-desc">
                        {catalogDescription(type.description, type.name) ||
                          tr("guest:homePage.aRoomWithNaturalMaterialsPlentyOfLightAndAllStandardAmenities")}
                      </p>

                      <div className="showcase-specs">
                        <span className="spec-item">
                          <BedDouble size={14} /> {tr("guest:homePage.premiumMattress")}</span>
                        <span className="spec-item">
                          <Wifi size={14} /> {tr("guest:homePage.highSpeedWiFi")}</span>
                        <span className="spec-item">
                          <Coffee size={14} /> {tr("guest:homePage.complimentaryTeaBottledWater")}</span>
                      </div>

                      <div className="showcase-actions">
                        <LinkButton
                          to={`/rooms?roomTypeId=${type.id}`}
                          variant="secondary"
                          className="btn-details"
                        >{tr("guest:homePage.viewRoomDetails")}</LinkButton>
                        <LinkButton
                          to={bookUrl}
                          variant="primary"
                          className="btn-book-now"
                        >
                          {tr("guest:homePage.bookThisRoom")}<ArrowRight size={16} />
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
              {tr("guest:homePage.exploreAllRoomsAvailableToday")}<ArrowRight size={17} />
            </LinkButton>
          </div>
        </div>
      </section>

      {/* 4. QUY TRÌNH 3 BƯỚC ĐẶT PHÒNG NHANH CHÓNG */}
      <section className="booking-steps-section site-container" aria-label={tr("guest:homePage.bookingProcess")}>
        <div className="section-heading text-center">
          <div>
            <p className="eyebrow">{tr("guest:homePage.aSimpleProcess")}</p>
            <h2><Trans ns="guest" i18nKey="homePage.bookInJust3Steps" components={{ part0: <em /> }} /></h2>
          </div>
          <p>{tr("guest:homePage.smartTransparentAndFastOnlineBooking")}</p>
        </div>

        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">01</div>
            <div className="step-icon">
              <CalendarCheck size={28} strokeWidth={1.4} />
            </div>
            <h4>{tr("guest:homePage.chooseDatesRoomType")}</h4>
            <p>{tr("guest:homePage.enterCheckInAndCheckOutDatesAndGuestNumbersToSee")}</p>
          </div>

          <div className="step-card">
            <div className="step-number">02</div>
            <div className="step-icon">
              <ShieldCheck size={28} strokeWidth={1.4} />
            </div>
            <h4>{tr("guest:homePage.confirmYourDetails")}</h4>
            <p>{tr("guest:homePage.enterYourContactDetailsInJust60SecondsNoComplicatedCreditCard")}</p>
          </div>

          <div className="step-card">
            <div className="step-number">03</div>
            <div className="step-icon">
              <Sparkles size={28} strokeWidth={1.4} />
            </div>
            <h4>{tr("guest:homePage.checkInEnjoy")}</h4>
            <p>{tr("guest:homePage.receiveYourReservationCodeInstantlyThroughTheSystemPayFlexiblyAtCheck")}</p>
          </div>
        </div>
      </section>

      {/* 5. BOOKING FAQ - GIẢI TỎA THẮC MẮC CỦA KHÁCH HÀNG */}
      <section className="booking-faq-section site-container" aria-label={tr("guest:homePage.frequentlyAskedBookingQuestions")}>
        <div className="faq-layout">
          <div className="faq-intro">
            <div className="intro-marker">
              <span className="small-star">✳</span>
              <p className="eyebrow">{tr("guest:homePage.bookingSupport")}</p>
            </div>
            <h2><Trans ns="guest" i18nKey="homePage.frequentlyAskedQuestionsFromOurGuests" components={{ part0: <br />, part1: <em /> }} /></h2>
            <p>{tr("guest:homePage.weKeepInformationTransparentSoYouCanEnjoyACompleteWorryFree")}</p>
            <div className="faq-support-card">
              <div className="support-icon">
                <PhoneCall size={22} />
              </div>
              <div>
                <strong>{tr("guest:homePage.needUrgentBookingAssistance")}</strong>
                <p>{tr("guest:homePage.247ReceptionHotline0987654321")}</p>
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
            <p className="eyebrow light">{tr("guest:homePage.aRelaxingGetaway")}</p>
            <h2><Trans ns="guest" i18nKey="homePage.readyForYourNextTrip" components={{ part0: <br />, part1: <em /> }} /></h2>
          </div>
          <div>
            <p>{tr("guest:homePage.theAnNhienHotelTeamIsReadyToWelcomeYouBookDirectly", { value0: (lowestPrice ? tr("common:supplement.startingPrice", { value0: money(lowestPrice.nightlyPrice) }) : '') })}</p>
            <div className="cta-actions-group">
              <LinkButton to="/rooms" variant="light">
                {tr("guest:homePage.viewRoomsBookNow")}<ArrowRight size={18} />
              </LinkButton>
              <LinkButton to="/register" variant="secondary">{tr("guest:homePage.createAMemberAccount")}</LinkButton>
            </div>
          </div>
        </div>
      </section>

      {/* 7. STICKY MOBILE BOOKING BAR - DÀNH CHO ĐIỆN THOẠI */}
      <aside className="mobile-sticky-booking-bar" aria-label={tr("guest:homePage.quickBooking")}>
        <div className="mobile-sticky-content">
          <div className="mobile-sticky-price">
            <span className="price-label">{tr("guest:homePage.ratesFrom")}</span>
            <strong>{lowestPrice ? money(lowestPrice.nightlyPrice) : '650.000 ₫'}</strong>
            <small>{tr("guest:homePage.night")}</small>
          </div>
          <LinkButton to="/rooms" variant="primary" className="mobile-sticky-cta">
            {tr("guest:homePage.bookNow")}<ArrowRight size={15} />
          </LinkButton>
        </div>
      </aside>
    </div>
  );
}
