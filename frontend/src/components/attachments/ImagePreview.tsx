import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ZoomIn, ZoomOut, RotateCcw, X, Download, ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageItem {
  url: string;
  name: string;
}

interface Props {
  images?: ImageItem[];
  initialIndex?: number;
  src?: string; // Fallback for single image
  alt?: string; // Fallback for single image
  onClose: () => void;
}

export function ImagePreview({ images = [], initialIndex = 0, src, alt, onClose }: Props) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const currentImage = images.length > 0 ? images[currentIndex] : { url: src || '', name: alt || '' };

  const handleReset = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleNext = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex(prev => (prev + 1) % images.length);
    handleReset();
  }, [images.length, handleReset]);

  const handlePrev = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex(prev => (prev - 1 + images.length) % images.length);
    handleReset();
  }, [images.length, handleReset]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '=' || e.key === '+') handleZoomIn();
      if (e.key === '-') handleZoomOut();
      if (e.key === '0') handleReset();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, handleReset, handleNext, handlePrev]);

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.5, 5));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.5, 0.5));
  
  const handleToggleZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scale > 1) {
      handleReset();
    } else {
      const nextScale = 2.5;
      // Get click position relative to the image center
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - (rect.left + rect.width / 2);
      const y = e.clientY - (rect.top + rect.height / 2);
      
      // Calculate how much we need to shift the image to put the clicked point at visual center
      // Since we are scaling UP, we shift the position in the OPPOSITE direction of the click offset
      setPosition({
        x: -x * (nextScale - 0.5), // Tweak factor for better centering result
        y: -y * (nextScale - 0.5)
      });
      setScale(nextScale);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale(prev => Math.min(Math.max(prev + delta, 0.5), 5));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };


  const handleMouseUp = () => setIsDragging(false);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.transform = `translate(${position.x}px, ${position.y}px) scale(${scale})`;
    }
  }, [position, scale]);

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/90 backdrop-blur-md overflow-hidden selection:bg-transparent"
      onClick={onClose}
      onWheel={handleWheel}
    >
      {/* Top Toolbar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-20 pointer-events-none">
        <div className="flex items-center gap-3 bg-black/40 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/10 pointer-events-auto">
          <p className="text-white text-sm font-semibold truncate max-w-[200px] sm:max-w-md">{currentImage.name}</p>
          <span className="text-white/40 text-xs font-bold px-2 py-0.5 bg-white/5 rounded-md">
            {Math.round(scale * 100)}%
          </span>
          {images.length > 1 && (
            <span className="text-white/40 text-[10px] font-black tracking-widest ml-2 px-2 border-l border-white/10 italic">
              {currentIndex + 1} / {images.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center bg-black/40 backdrop-blur-xl p-1 rounded-2xl border border-white/10 gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              title="Zoom Out (-)"
            >
              <ZoomOut size={18} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleReset(); }}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              title="Reset Zoom (0)"
            >
              <RotateCcw size={18} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              title="Zoom In (+)"
            >
              <ZoomIn size={18} />
            </button>
          </div>

          <a
            href={currentImage.url}
            download={currentImage.name}
            onClick={(e) => e.stopPropagation()}
            className="p-2.5 bg-black/40 backdrop-blur-xl text-white/70 hover:text-white hover:bg-white/10 rounded-2xl border border-white/10 transition-all"
            title="Download"
          >
            <Download size={20} />
          </a>

          <button
            onClick={onClose}
            className="p-2.5 bg-red-500/10 backdrop-blur-xl text-red-500 hover:bg-red-500 hover:text-white rounded-2xl border border-red-500/20 transition-all"
            title="Close (Esc)"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Carousel Navigation */}
      {images.length > 1 && scale === 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            className="absolute left-6 top-1/2 -translate-y-1/2 p-4 bg-white/5 hover:bg-white/10 text-white rounded-full backdrop-blur-md border border-white/10 transition-all z-50 group active:scale-90"
            title="Previous"
          >
            <ChevronLeft size={32} className="group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            className="absolute right-6 top-1/2 -translate-y-1/2 p-4 bg-white/5 hover:bg-white/10 text-white rounded-full backdrop-blur-md border border-white/10 transition-all z-50 group active:scale-90"
            title="Next"
          >
            <ChevronRight size={32} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </>
      )}

      {/* Main Image Container */}
      <div
        ref={containerRef}
        className={`relative transition-transform duration-75 ease-out ${
          isDragging ? 'cursor-grabbing' : 
          scale > 1 ? 'cursor-zoom-out' : 'cursor-zoom-in'
        }`}
        onClick={handleToggleZoom}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          src={currentImage.url}
          alt={currentImage.name}
          className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl select-none pointer-events-none"
          draggable={false}
        />
      </div>

      {/* Helper text */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/5 text-[10px] text-white/40 font-bold uppercase tracking-[0.2em] pointer-events-none flex items-center gap-4">
        <span>Ctrl + Scroll to Zoom</span>
        <span className="w-1 h-1 rounded-full bg-white/20" />
        <span>Click Image to Toggle Zoom</span>
        {images.length > 1 && (
          <>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span>Arrow Keys to Navigate</span>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
