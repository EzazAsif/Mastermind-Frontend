// ViewPdf.jsx (FULL SCREEN + PINCH ZOOM + PAN + SWIPE PAGE)
// + Go To Page inside bottom black bar

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

  const [isZoomed, setIsZoomed] = useState(false);

  // ---------- Go To Page ----------
  const [isGotoOpen, setIsGotoOpen] = useState(false);
  const [gotoValue, setGotoValue] = useState("");
  const gotoInputRef = useRef(null);

  const clampPage = useCallback(
    (value) => {
      const total = Number(numPages || 1);
      const v = Number(value);
      if (!Number.isFinite(v)) return currentPage;
      return Math.max(1, Math.min(total, Math.trunc(v)));
    },
    [numPages, currentPage],
  );

  const openGoto = useCallback(() => {
    setGotoValue(String(currentPage));
    setIsGotoOpen(true);
    requestAnimationFrame(() => gotoInputRef.current?.focus());
  }, [currentPage]);

  const closeGoto = useCallback(() => {
    setIsGotoOpen(false);
  }, []);

  const applyGoto = useCallback(() => {
    const target = clampPage(gotoValue);
    setCurrentPage(target);
    setIsGotoOpen(false);
  }, [clampPage, gotoValue]);

  // ---------- Lock Body Scroll ----------
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

  // ---------- Resize ----------
  useEffect(() => {
    if (!containerRef.current) return;
    const node = containerRef.current;

    const update = () => setContainerWidth(Math.max(1, node.clientWidth - 24));

    update();
    const ro = new ResizeObserver(() => requestAnimationFrame(update));
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  // ---------- PDF ----------
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

  // Reset zoom when page changes
  const zoomApiRef = useRef(null);
  useEffect(() => {
    zoomApiRef.current?.resetTransform?.();
    setIsZoomed(false);
  }, [currentPage]);

  // ---------- Keyboard ----------
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        if (isGotoOpen) closeGoto();
        else onBack?.();
      }
      if (!isGotoOpen) {
        if (e.key === "ArrowLeft") prevPage();
        if (e.key === "ArrowRight") nextPage();
      }
      if (isGotoOpen && e.key === "Enter") applyGoto();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onBack, prevPage, nextPage, isGotoOpen, closeGoto, applyGoto]);

  // ---------- Swipe (Only when not zoomed & not overlay) ----------
  const swipeRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
  });

  const onPointerDown = useCallback(
    (e) => {
      if (isZoomed || isGotoOpen) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;

      swipeRef.current.active = true;
      swipeRef.current.startX = e.clientX;
      swipeRef.current.startY = e.clientY;
      swipeRef.current.lastX = e.clientX;
      swipeRef.current.lastY = e.clientY;
    },
    [isZoomed, isGotoOpen],
  );

  const onPointerMove = useCallback(
    (e) => {
      if (isZoomed || isGotoOpen) return;
      if (!swipeRef.current.active) return;

      swipeRef.current.lastX = e.clientX;
      swipeRef.current.lastY = e.clientY;
    },
    [isZoomed, isGotoOpen],
  );

  const onPointerUp = useCallback(() => {
    if (isZoomed || isGotoOpen) return;
    if (!swipeRef.current.active) return;

    swipeRef.current.active = false;

    const dx = swipeRef.current.lastX - swipeRef.current.startX;
    const dy = swipeRef.current.lastY - swipeRef.current.startY;

    if (Math.abs(dx) >= 60 && Math.abs(dy) <= 70) {
      if (dx < 0 && canNext) nextPage();
      if (dx > 0 && canPrev) prevPage();
    }
  }, [isZoomed, isGotoOpen, canNext, canPrev, nextPage, prevPage]);

  const file = useMemo(() => (fileUrl ? { url: fileUrl } : null), [fileUrl]);

  if (!fileUrl) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[9999] bg-black"
      style={{ touchAction: "auto", overscrollBehavior: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* PDF */}
      <div
        ref={containerRef}
        className="absolute inset-0 flex items-center justify-center"
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
              onInit={(api) => (zoomApiRef.current = api)}
              onZoomStop={(api) => setIsZoomed(api.state.scale > 1.01)}
              onTransformed={(api) => setIsZoomed(api.state.scale > 1.01)}
              doubleClick={{ mode: "zoomIn" }}
              wheel={{ disabled: true }}
            >
              <TransformComponent
                wrapperStyle={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  touchAction: "none",
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

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-4 bg-black/70">
        <button
          onClick={onBack}
          className="px-3 py-2 rounded-xl bg-white/10 text-white"
        >
          ← Back
        </button>

        <div className="text-white text-sm">PDF Viewer</div>

        <div />
      </div>

      {/* Bottom Black Bar */}
      <div className="absolute bottom-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-4 bg-black/70">
        <div className="text-xs text-white/70">
          {isZoomed ? "Pinch • Drag • Double tap" : "Swipe ← / →"}
        </div>

        <button
          onClick={openGoto}
          className="text-sm text-white px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20"
        >
          {currentPage} / {numPages ?? "—"}
        </button>

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

      {/* Go To Overlay */}
      {isGotoOpen && (
        <div
          className="absolute inset-0 z-[80] flex items-center justify-center bg-black/50"
          onClick={closeGoto}
        >
          <div
            className="bg-black/80 p-5 rounded-2xl border border-white/10 w-[90%] max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-white mb-3">
              Go to page (1 - {numPages ?? "—"})
            </div>

            <div className="flex gap-2">
              <input
                ref={gotoInputRef}
                value={gotoValue}
                onChange={(e) =>
                  setGotoValue(e.target.value.replace(/\D/g, ""))
                }
                className="flex-1 px-3 py-2 rounded-xl bg-white/10 text-white outline-none"
                inputMode="numeric"
                placeholder="Page number"
              />

              <button
                onClick={applyGoto}
                className="px-4 py-2 rounded-xl bg-white/20 text-white"
              >
                Go
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
