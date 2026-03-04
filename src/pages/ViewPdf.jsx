// ViewPdf.jsx (CONTINUOUS VERTICAL SCROLL + PINCH ZOOM + PAN + GO TO PAGE)
// - Renders ALL pages (vertical scroll)
// - Mobile: prefer FULL WIDTH
// - Desktop: prefer FULL HEIGHT (each page fits viewport height) but auto-switch if it would crop
// - Keeps zoom/pan via react-zoom-pan-pinch
// - Boosts react-pdf canvas resolution using devicePixelRatio based on current zoom
// - Removes left/right swipe + buttons; keeps page navigation via Go To (scroll to page)

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

  // Scrollable content area between bars
  const scrollRef = useRef(null);

  // Measure viewport between bars (for responsive sizing)
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ w: 1, h: 1 });

  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);

  // PDF page natural size (aspect ratio) - we grab from first page
  const [pageDims, setPageDims] = useState({ w: null, h: null });

  // Detect Android
  const isAndroid = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /Android/i.test(navigator.userAgent || "");
  }, []);

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

  const closeGoto = useCallback(() => setIsGotoOpen(false), []);

  // page wrapper refs for scroll-to + intersection tracking
  const pageWrapRefs = useRef([]);

  const scrollToPage = useCallback((p) => {
    const node = pageWrapRefs.current?.[p - 1];
    if (node && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const applyGoto = useCallback(() => {
    const target = clampPage(gotoValue);
    setCurrentPage(target);
    setIsGotoOpen(false);
    requestAnimationFrame(() => scrollToPage(target));
  }, [clampPage, gotoValue, scrollToPage]);

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

  // ---------- Resize (measure between bars) ----------
  useEffect(() => {
    if (!containerRef.current) return;
    const node = containerRef.current;

    const update = () => {
      setContainerSize({
        w: Math.max(1, node.clientWidth),
        h: Math.max(1, node.clientHeight),
      });
    };

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
    pageWrapRefs.current = new Array(n).fill(null);
  };

  const onDocumentLoadError = (err) => {
    setLoadError(err?.message || "Failed to load PDF");
  };

  const file = useMemo(() => (fileUrl ? { url: fileUrl } : null), [fileUrl]);

  // ---------- Best-fit sizing (platform preference + PDF AR) ----------
  const pageAR = useMemo(() => {
    const w = pageDims.w;
    const h = pageDims.h;
    if (!w || !h) return null;
    return w / h;
  }, [pageDims]);

  const renderSize = useMemo(() => {
    const cw = Math.max(1, containerSize.w);
    const ch = Math.max(1, containerSize.h);

    // If we don't know AR yet: mobile width, desktop height
    if (!pageAR) {
      return isAndroid
        ? { mode: "width", width: cw }
        : { mode: "height", height: ch };
    }

    const preferred = isAndroid ? "width" : "height";

    if (preferred === "width") {
      const hByWidth = cw / pageAR;
      if (hByWidth <= ch) return { mode: "width", width: cw };
      return { mode: "height", height: ch };
    } else {
      const wByHeight = ch * pageAR;
      if (wByHeight <= cw) return { mode: "height", height: ch };
      return { mode: "width", width: cw };
    }
  }, [containerSize, pageAR, isAndroid]);

  // ---------- Quality: devicePixelRatio boosted by zoom ----------
  const devicePixelRatio = useMemo(() => {
    const base =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    return Math.max(1, Math.min(4, base * (zoomScale || 1) * 1.25));
  }, [zoomScale]);

  // ---------- Zoom API ----------
  const zoomApiRef = useRef(null);

  // When zoomed, disable vertical scrolling to avoid fighting pan gestures
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.style.overflowY = isZoomed ? "hidden" : "auto";
  }, [isZoomed]);

  // ---------- Track current page while scrolling (IntersectionObserver) ----------
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !numPages) return;

    const obs = new IntersectionObserver(
      (entries) => {
        // pick the most visible intersecting page
        let best = null;
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          if (!best || e.intersectionRatio > best.intersectionRatio) best = e;
        }
        if (best?.target) {
          const p = Number(best.target.getAttribute("data-page") || "1");
          if (Number.isFinite(p) && p !== currentPage) setCurrentPage(p);
        }
      },
      { root, threshold: [0.35, 0.5, 0.65, 0.8] },
    );

    pageWrapRefs.current.forEach((node) => node && obs.observe(node));
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numPages]);

  // ---------- Keyboard (+ / - / 0) + navigation ----------
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        if (isGotoOpen) closeGoto();
        else onBack?.();
        return;
      }

      if (isGotoOpen && e.key === "Enter") {
        applyGoto();
        return;
      }

      // Zoom controls
      if (!isGotoOpen) {
        if (e.key === "+" || e.key === "=") {
          e.preventDefault();
          zoomApiRef.current?.zoomIn?.(0.25);
        }
        if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          zoomApiRef.current?.zoomOut?.(0.25);
        }
        if (e.key === "0") {
          e.preventDefault();
          zoomApiRef.current?.resetTransform?.();
          setIsZoomed(false);
          setZoomScale(1);
        }

        // Page navigation (scroll-to)
        if (e.key === "PageDown") {
          e.preventDefault();
          const next = Math.min(numPages || 1, currentPage + 1);
          scrollToPage(next);
        }
        if (e.key === "PageUp") {
          e.preventDefault();
          const prev = Math.max(1, currentPage - 1);
          scrollToPage(prev);
        }
        if (e.key === "Home") {
          e.preventDefault();
          scrollToPage(1);
        }
        if (e.key === "End") {
          e.preventDefault();
          scrollToPage(numPages || 1);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    onBack,
    isGotoOpen,
    closeGoto,
    applyGoto,
    currentPage,
    numPages,
    scrollToPage,
  ]);

  if (!fileUrl) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[9999] bg-black"
      style={{ touchAction: "auto", overscrollBehavior: "none" }}
    >
      {/* Scroll container (ONLY between bars) */}
      <div
        ref={containerRef}
        className="absolute left-0 right-0 top-16 bottom-16"
      >
        <div
          ref={scrollRef}
          className="w-full h-full overflow-y-auto"
          style={{
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
          }}
        >
          {loadError ? (
            <div className="text-white/80 text-sm p-4">{loadError}</div>
          ) : (
            <Document
              file={file}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={<div className="text-white/70 p-4">Loading PDF…</div>}
            >
              <TransformWrapper
                minScale={1}
                maxScale={4}
                centerOnInit
                onInit={(api) => (zoomApiRef.current = api)}
                onZoomStop={(api) => {
                  const s = api?.state?.scale || 1;
                  setZoomScale(s);
                  setIsZoomed(s > 1.01);
                }}
                onTransformed={(api) => {
                  const s = api?.state?.scale || 1;
                  setZoomScale(s);
                  setIsZoomed(s > 1.01);
                }}
                doubleClick={{ mode: "zoomIn" }}
                wheel={{ disabled: true }}
              >
                <TransformComponent
                  wrapperStyle={{
                    width: "100%",
                    // allow natural height since we stack pages
                    display: "flex",
                    justifyContent: "center",
                    touchAction: "none",
                  }}
                  contentStyle={{
                    width: "100%",
                  }}
                >
                  <div className="w-full flex flex-col items-center gap-4 py-4">
                    {Array.from(new Array(numPages || 0), (_, i) => {
                      const pageNumber = i + 1;
                      return (
                        <div
                          key={`pwrap-${pageNumber}`}
                          data-page={pageNumber}
                          ref={(el) => (pageWrapRefs.current[i] = el)}
                          className="w-full flex items-center justify-center"
                        >
                          <Page
                            pageNumber={pageNumber}
                            onLoadSuccess={(page) => {
                              // take AR from first loaded page
                              if (pageNumber !== 1) return;
                              try {
                                const v = page?.view; // [xMin, yMin, xMax, yMax]
                                if (Array.isArray(v) && v.length === 4) {
                                  const w = Math.abs(v[2] - v[0]);
                                  const h = Math.abs(v[3] - v[1]);
                                  if (w > 0 && h > 0) setPageDims({ w, h });
                                }
                              } catch {
                                // ignore
                              }
                            }}
                            {...(renderSize.mode === "width"
                              ? { width: renderSize.width }
                              : { height: renderSize.height })}
                            devicePixelRatio={devicePixelRatio}
                            renderTextLayer={false}
                            renderAnnotationLayer={true}
                          />
                        </div>
                      );
                    })}
                  </div>
                </TransformComponent>
              </TransformWrapper>
            </Document>
          )}
        </div>
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

      {/* Bottom Black Bar (no left/right buttons) */}
      <div className="absolute bottom-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-4 bg-black/70">
        <div className="text-xs text-white/70">
          {isZoomed ? "Pinch • Drag • Double tap" : "Scroll"} | Zoom: + / - / 0
        </div>

        <button
          onClick={openGoto}
          className="text-sm text-white px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20"
        >
          {currentPage} / {numPages ?? "—"}
        </button>

        <div className="text-xs text-white/60">PgUp/PgDn • Home/End</div>
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
