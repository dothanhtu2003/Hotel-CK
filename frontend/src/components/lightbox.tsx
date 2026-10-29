import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react';

export interface GalleryImage {
  src: string;
  alt: string;
  title?: string;
  category?: string;
}

export function Lightbox({
  images,
  initialIndex = 0,
  open,
  onClose,
}: {
  images: GalleryImage[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setCurrentIndex((i) => (i + 1) % images.length);
      if (e.key === 'ArrowLeft') setCurrentIndex((i) => (i - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, images.length, onClose]);

  if (!open || !images.length) return null;

  const current = images[currentIndex];

  return (
    <div
      className="lightbox-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Thư viện ảnh phòng"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="lightbox-topbar">
        <span className="lightbox-counter">
          {currentIndex + 1} / {images.length} · {current.title ?? current.alt}
        </span>
        <button
          className="icon-button lightbox-close"
          onClick={onClose}
          aria-label="Đóng thư viện ảnh"
        >
          <X size={24} />
        </button>
      </div>

      <div className="lightbox-viewport">
        {images.length > 1 && (
          <button
            className="lightbox-nav lightbox-prev"
            onClick={() => setCurrentIndex((i) => (i - 1 + images.length) % images.length)}
            aria-label="Ảnh trước"
          >
            <ChevronLeft size={32} />
          </button>
        )}

        <div className="lightbox-figure">
          <img
            src={current.src}
            alt={current.alt}
            className="lightbox-image"
          />
          {current.title && <p className="lightbox-caption">{current.title}</p>}
        </div>

        {images.length > 1 && (
          <button
            className="lightbox-nav lightbox-next"
            onClick={() => setCurrentIndex((i) => (i + 1) % images.length)}
            aria-label="Ảnh sau"
          >
            <ChevronRight size={32} />
          </button>
        )}
      </div>

      {images.length > 1 && (
        <div className="lightbox-thumbs">
          {images.map((img, idx) => (
            <button
              key={idx}
              className={`lightbox-thumb ${idx === currentIndex ? 'active' : ''}`}
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Xem ảnh ${idx + 1}`}
            >
              <img src={img.src} alt={img.alt} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function RoomGallery({
  images,
}: {
  images: GalleryImage[];
  roomName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const main = images[0];
  const side = images.slice(1, 4);

  return (
    <>
      <div className="room-gallery-grid">
        <div
          className="gallery-main-item"
          role="button"
          tabIndex={0}
          onClick={() => {
            setIndex(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setIndex(0);
              setOpen(true);
            }
          }}
        >
          <img src={main.src} alt={main.alt} className="detail-photo" />
          <span className="gallery-badge">
            <Maximize2 size={14} /> Phóng to ({images.length} ảnh)
          </span>
        </div>

        {side.length > 0 && (
          <div className="gallery-side-thumbs">
            {side.map((img, i) => (
              <div
                key={i}
                className="gallery-thumb-item"
                role="button"
                tabIndex={0}
                onClick={() => {
                  setIndex(i + 1);
                  setOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setIndex(i + 1);
                    setOpen(true);
                  }
                }}
              >
                <img src={img.src} alt={img.alt} />
                <span className="thumb-label">{img.title ?? `Góc nhìn ${i + 2}`}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Lightbox
        images={images}
        initialIndex={index}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
