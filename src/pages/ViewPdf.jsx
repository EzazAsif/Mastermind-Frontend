// ViewPdf.jsx (FULL SCREEN FIXED)
// Back button fully clickable
// Tap zones start below header
// Overlay bars visible
// Proper z-index layering

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Document, Page, pdfjs } from "react-pdf";

import "react-pdf/dist/esm/Page/AnnotationLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

export default function ViewPdf({ fileName, onBack }) {
  const fileUrl = fileName;

  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadError, setLoadError] = useState(null);

  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(1);

  // -------- Lock body scroll --------
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;

    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyPosition = body.style.position;
    const prevBodyTop = body.style.top;
    const prevBodyWidth = body.style.width;

    const scrollY = window.scrollY || 0;

    body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";

    return () => {
      body.style.overflow = prevBodyOverflow;
      html.style.overflow = prevHtmlOverflow;
      body.style.position = prevBodyPosition;
      body.style.top = prevBodyTop;
      body.style.width = prevBodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, []);

  // -------- Measure width --------
  useEffect(() => {
    if (!containerRef.current) return;
    const node = containerRef.current;

    const update = () => {
      setContainerWidth(Math.max(1, node.clientWidth - 24));
    };

    update();
    const ro = new ResizeObserver(() => requestAnimationFrame(update));
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  // -------- PDF callbacks --------
  const onDocumentLoadSuccess = ({ numPages: n }) => {
    setNumPages(n);
    setLoadError(null);

    // Keep valid page, don't force 1 every time
    setCurrentPage((p) => Math.max(1, Math.min(n || 1, p || 1)));
  };

  const onDocumentLoadError = (err) => {
    setLoadError(err?.message || "Failed to load PDF");
  };

  const canPrev = currentPage > 1;
  const canNext = numPages ? currentPage < numPages : false;

  const prevPage = useCallback(() => {
    setCurrentPage((p) => Math.max(1, p - 1));
  }, []);

  const nextPage = useCallback(() => {
    setCurrentPage((p) => Math.min(numPages || 1, p + 1));
  }, [numPages]);

  // -------- Keyboard support --------
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onBack?.();
      if (e.key === "ArrowLeft") prevPage();
      if (e.key === "ArrowRight") nextPage();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onBack, prevPage, nextPage]);

  // -------- Swipe logic --------
  const swipeRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
  });

  const SWIPE_MIN_X = 60;
  const SWIPE_MAX_Y = 70;

  const onPointerDown = useCallback((e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    swipeRef.current.active = true;
    swipeRef.current.startX = e.clientX;
    swipeRef.current.startY = e.clientY;
    swipeRef.current.lastX = e.clientX;
    swipeRef.current.lastY = e.clientY;
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!swipeRef.current.active) return;
    swipeRef.current.lastX = e.clientX;
    swipeRef.current.lastY = e.clientY;
  }, []);

  const onPointerUp = useCallback(
    (e) => {
      if (!swipeRef.current.active) return;
      swipeRef.current.active = false;

      const dx = swipeRef.current.lastX - swipeRef.current.startX;
      const dy = swipeRef.current.lastY - swipeRef.current.startY;

      if (Math.abs(dx) >= SWIPE_MIN_X && Math.abs(dy) <= SWIPE_MAX_Y) {
        if (dx < 0 && canNext) nextPage();
        if (dx > 0 && canPrev) prevPage();
      }
    },
    [canNext, canPrev, nextPage, prevPage],
  );

  const file = useMemo(() => (fileUrl ? { url: fileUrl } : null), [fileUrl]);

  if (!fileUrl) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[9999] bg-black"
      style={{ touchAction: "pan-y", overscrollBehavior: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* PDF Layer */}
      <div
        ref={containerRef}
        className="absolute inset-0 z-0 flex items-center justify-center"
      >
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={<div className="text-white/70">Loading PDF…</div>}
        >
          <Page
            pageNumber={currentPage}
            width={containerWidth}
            renderTextLayer={false}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>

      {/* Black Bars */}
      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="absolute top-0 left-0 right-0 h-20 bg-black/70" />
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-black/70" />
        <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-black/80 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-black/80 to-transparent" />
      </div>

      {/* Top Controls (HIGH Z) */}
      <div className="absolute top-0 left-0 right-0 z-50 p-3 flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="px-3 py-2 rounded-xl bg-white/10 text-white hover:bg-white/15 transition"
        >
          ← Back
        </button>

        <div className="text-white text-sm px-3 py-2 rounded-xl bg-white/10">
          {currentPage} / {numPages ?? "—"}
        </div>

        <div className="flex gap-2">
          <button
            onClick={prevPage}
            disabled={!canPrev}
            className="px-3 py-2 rounded-xl bg-white/10 text-white disabled:opacity-40"
          >
            ◀
          </button>
          <button
            onClick={nextPage}
            disabled={!canNext}
            className="px-3 py-2 rounded-xl bg-white/10 text-white disabled:opacity-40"
          >
            ▶
          </button>
        </div>
      </div>

      {/* Tap zones START BELOW header */}
      <button
        onClick={prevPage}
        disabled={!canPrev}
        className="absolute left-0 top-20 z-20 h-[calc(100%-5rem)] w-[18%] disabled:opacity-0"
        style={{ background: "transparent" }}
      />
      <button
        onClick={nextPage}
        disabled={!canNext}
        className="absolute right-0 top-20 z-20 h-[calc(100%-5rem)] w-[18%] disabled:opacity-0"
        style={{ background: "transparent" }}
      />

      {/* Bottom Hint */}
      <div className="absolute bottom-3 left-1/2 z-30 -translate-x-1/2 text-xs text-white/80 px-3 py-2 rounded-xl bg-white/10">
        Swipe ← / → to change page
      </div>
    </motion.div>
  );
}
