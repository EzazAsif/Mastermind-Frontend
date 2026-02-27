// ViewPdf.jsx (FULL SCREEN + PINCH ZOOM + PAN + SWIPE PAGE)
// - Pinch zoom + pan via react-zoom-pan-pinch
// - Swipe left/right changes page ONLY when not zoomed
// - Tap zones still work when not zoomed
// - Top controls always clickable

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Document, Page, pdfjs } from "react-pdf";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

import "react-pdf/dist/esm/Page/AnnotationLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

export default function ViewPdf({ fileName, onBack }) {
  const fileUrl = fileName;

  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadError, setLoadError] = useState(null);

  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(1);

  // Track whether user is zoomed in (scale > 1)
  const [isZoomed, setIsZoomed] = useState(false);

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

    const update = () => setContainerWidth(Math.max(1, node.clientWidth - 24));

    update();
    const ro = new ResizeObserver(() => requestAnimationFrame(update));
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  // -------- PDF callbacks --------
  const onDocumentLoadSuccess = ({ numPages: n }) => {
    setNumPages(n);
    setLoadError(null);
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

  // Reset zoom when page changes (so user doesn't get stuck zoomed on next page)
  const zoomApiRef = useRef(null);
  useEffect(() => {
    // If we have a zoom api, reset to 1x when page changes
    zoomApiRef.current?.resetTransform?.();
    setIsZoomed(false);
  }, [currentPage]);

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

  // -------- Swipe logic (ONLY when not zoomed) --------
  const swipeRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
  });

  const SWIPE_MIN_X = 60;
  const SWIPE_MAX_Y = 70;

  const onPointerDown = useCallback(
    (e) => {
      if (isZoomed) return; // allow pan/zoom instead
      if (e.pointerType === "mouse" && e.button !== 0) return;

      swipeRef.current.active = true;
      swipeRef.current.startX = e.clientX;
      swipeRef.current.startY = e.clientY;
      swipeRef.current.lastX = e.clientX;
      swipeRef.current.lastY = e.clientY;
    },
    [isZoomed],
  );

  const onPointerMove = useCallback(
    (e) => {
      if (isZoomed) return;
      if (!swipeRef.current.active) return;

      swipeRef.current.lastX = e.clientX;
      swipeRef.current.lastY = e.clientY;
    },
    [isZoomed],
  );

  const onPointerUp = useCallback(() => {
    if (isZoomed) return;
    if (!swipeRef.current.active) return;

    swipeRef.current.active = false;

    const dx = swipeRef.current.lastX - swipeRef.current.startX;
    const dy = swipeRef.current.lastY - swipeRef.current.startY;

    if (Math.abs(dx) >= SWIPE_MIN_X && Math.abs(dy) <= SWIPE_MAX_Y) {
      if (dx < 0 && canNext) nextPage();
      if (dx > 0 && canPrev) prevPage();
    }
  }, [isZoomed, canNext, canPrev, nextPage, prevPage]);

  const file = useMemo(() => (fileUrl ? { url: fileUrl } : null), [fileUrl]);
  if (!fileUrl) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[9999] bg-black"
      // IMPORTANT: don't restrict gestures here
      style={{ touchAction: "auto", overscrollBehavior: "none" }}
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
        {loadError ? (
          <div className="text-white/80 text-sm p-4">{loadError}</div>
        ) : (
          <Document
            file={file}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={<div className="text-white/70">Loading PDF…</div>}
          >
            <TransformWrapper
              minScale={1}
              maxScale={4}
              centerOnInit
              // Keep a handle so we can reset on page change if we want
              onInit={(api) => (zoomApiRef.current = api)}
              onZoomStop={(api) => setIsZoomed(api.state.scale > 1.01)}
              onTransformed={(api) => setIsZoomed(api.state.scale > 1.01)}
              pinch={{ step: 5 }}
              panning={{ velocityDisabled: true }}
              doubleClick={{ mode: "zoomIn" }}
              wheel={{ disabled: true }} // optional: disable mouse wheel zoom
            >
              <TransformComponent
                wrapperStyle={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  // CRITICAL: allow pinch + pan
                  touchAction: "none",
                }}
                contentStyle={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Page
                  pageNumber={currentPage}
                  width={containerWidth}
                  renderTextLayer={false}
                  renderAnnotationLayer={true}
                />
              </TransformComponent>
            </TransformWrapper>
          </Document>
        )}
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

      {/* Tap zones START BELOW header (disable when zoomed so pan works) */}
      <button
        onClick={prevPage}
        disabled={!canPrev || isZoomed}
        className="absolute left-0 top-20 z-20 h-[calc(100%-5rem)] w-[18%] disabled:opacity-0"
        style={{ background: "transparent" }}
      />
      <button
        onClick={nextPage}
        disabled={!canNext || isZoomed}
        className="absolute right-0 top-20 z-20 h-[calc(100%-5rem)] w-[18%] disabled:opacity-0"
        style={{ background: "transparent" }}
      />

      {/* Bottom Hint */}
      <div className="absolute bottom-3 left-1/2 z-30 -translate-x-1/2 text-xs text-white/80 px-3 py-2 rounded-xl bg-white/10">
        {isZoomed
          ? "Pinch to zoom • Drag to pan • Double tap to zoom"
          : "Swipe ← / → to change page"}
      </div>
    </motion.div>
  );
}
