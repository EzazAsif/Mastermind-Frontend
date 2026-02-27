// ViewPdf.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Document, Page, pdfjs } from "react-pdf";

import "react-pdf/dist/esm/Page/AnnotationLayer.css";
// import "react-pdf/dist/esm/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

export default function ViewPdf({ fileName, onBack }) {
  const fileUrl = fileName;

  // Fixed container; pinch zoom + drag scroll INSIDE
  const MIN_ZOOM = 50;
  const MAX_ZOOM = 300;

  const [zoom, setZoom] = useState(100);
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [containerWidth, setContainerWidth] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const [basePageWidth, setBasePageWidth] = useState(null); // at 100%
  const [basePageHeight, setBasePageHeight] = useState(null); // at 100%
  const [pageInput, setPageInput] = useState("1");

  const scrollerRef = useRef(null);

  // ---------- Measure container width ----------
  const roRef = useRef(null);
  const containerRef = useCallback((node) => {
    if (!node) return;
    scrollerRef.current = node;

    const padding = 32; // p-4
    const update = () => setContainerWidth(node.clientWidth - padding);

    update();
    const ro = new ResizeObserver(() => requestAnimationFrame(update));
    ro.observe(node);
    roRef.current = ro;
  }, []);
  useEffect(() => () => roRef.current?.disconnect(), []);

  // ---------- Helpers ----------
  const scrollToTopLeft = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    // Do it after layout/paint to avoid PDF render shifting scroll
    requestAnimationFrame(() => {
      scroller.scrollTop = 0;
      scroller.scrollLeft = 0;
    });
  }, []);

  // ---------- Document callbacks ----------
  const onDocumentLoadSuccess = ({ numPages: n }) => {
    setNumPages(n);
    setCurrentPage(1);
    setPageInput("1");
    setLoadError(null);

    // ✅ ensure initial top
    scrollToTopLeft();
  };

  const onDocumentLoadError = (err) => {
    console.error("PDF load error:", err);
    setLoadError(err?.message || "Failed to load PDF");
  };

  // ---------- Page navigation ----------
  const prevPage = () => {
    setCurrentPage((p) => {
      const next = Math.max(1, p - 1);
      setPageInput(String(next));
      return next;
    });
  };

  const nextPage = () => {
    setCurrentPage((p) => {
      const next = Math.min(numPages || 1, p + 1);
      setPageInput(String(next));
      return next;
    });
  };

  useEffect(() => setPageInput(String(currentPage)), [currentPage]);

  const clampPage = useCallback(
    (v) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return 1;
      const max = numPages || 1;
      return Math.min(Math.max(1, Math.trunc(n)), max);
    },
    [numPages],
  );

  const goToPage = useCallback(() => {
    const target = clampPage(pageInput);
    setCurrentPage(target);
    setPageInput(String(target));
  }, [clampPage, pageInput]);

  // ---------- Zoom helpers ----------
  const clampZoom = useCallback((z) => {
    // ✅ keep zoom always integer (no decimals from pinch)
    const zi = Math.round(z); // or Math.trunc(z)
    return Math.min(Math.max(zi, MIN_ZOOM), MAX_ZOOM);
  }, []);

  const zoomIn = () => setZoom((z) => clampZoom(z + 10));
  const zoomOut = () => setZoom((z) => clampZoom(z - 10));
  const resetZoom = () => setZoom(100);

  // ---------- Base render width (100% = fit container width) ----------
  const baseWidth = useMemo(() => {
    if (!containerWidth) return undefined;
    return Math.max(1, Math.floor(containerWidth));
  }, [containerWidth]);

  // Render at base width for sharpness; we visually scale via transform
  const scale = zoom / 100;

  // Use Page.onRenderSuccess to compute base height (via aspect ratio)
  const onPageRenderSuccess = useCallback(
    (page) => {
      try {
        const viewport = page.getViewport({ scale: 1 });
        const aspect = viewport.height / viewport.width;

        if (baseWidth) {
          setBasePageWidth(baseWidth);
          setBasePageHeight(Math.floor(baseWidth * aspect));
        }
      } catch {
        // ignore
      }

      // ✅ IMPORTANT: force top AFTER render finishes (fixes "loads from bottom")
      scrollToTopLeft();
    },
    [baseWidth, scrollToTopLeft],
  );

  // When page changes, reset scroll position (optional, keep it)
  useEffect(() => {
    scrollToTopLeft();
  }, [currentPage, scrollToTopLeft]);

  // ---------- Touch / Pointer pinch + pan ----------
  const pointersRef = useRef(new Map()); // pointerId -> {x,y}
  const gestureRef = useRef({
    mode: "none", // pan | pinch
    lastX: 0,
    lastY: 0,
    startDist: 0,
    startZoom: 100,
    startScrollLeft: 0,
    startScrollTop: 0,
    startMidX: 0,
    startMidY: 0,
  });

  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  // Keep pinch focus stable (zoom around the midpoint)
  const setZoomKeepingFocalPoint = useCallback(
    (newZoom, focalClientX, focalClientY) => {
      const scroller = scrollerRef.current;
      if (!scroller) return;

      const clamped = clampZoom(newZoom); // ✅ rounded + clamped

      const prevScale = zoom / 100;
      const nextScale = clamped / 100;

      const rect = scroller.getBoundingClientRect();
      const fx = focalClientX - rect.left;
      const fy = focalClientY - rect.top;

      const contentX = (scroller.scrollLeft + fx) / prevScale;
      const contentY = (scroller.scrollTop + fy) / prevScale;

      const nextScrollLeft = contentX * nextScale - fx;
      const nextScrollTop = contentY * nextScale - fy;

      setZoom(clamped);

      requestAnimationFrame(() => {
        scroller.scrollLeft = nextScrollLeft;
        scroller.scrollTop = nextScrollTop;
      });
    },
    [clampZoom, zoom],
  );

  const onPointerDown = useCallback(
    (e) => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;

      scroller.setPointerCapture?.(e.pointerId);
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      const pts = Array.from(pointersRef.current.values());
      const g = gestureRef.current;

      if (pts.length === 1) {
        g.mode = "pan";
        g.lastX = e.clientX;
        g.lastY = e.clientY;
      } else if (pts.length === 2) {
        const a = pts[0];
        const b = pts[1];
        const mid = midpoint(a, b);

        g.mode = "pinch";
        g.startDist = distance(a, b);
        g.startZoom = zoom;
        g.startScrollLeft = scroller.scrollLeft;
        g.startScrollTop = scroller.scrollTop;
        g.startMidX = mid.x;
        g.startMidY = mid.y;
      }
    },
    [zoom],
  );

  const onPointerMove = useCallback(
    (e) => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      if (!pointersRef.current.has(e.pointerId)) return;

      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      const pts = Array.from(pointersRef.current.values());
      const g = gestureRef.current;

      // 1 finger pan => scroll
      if (g.mode === "pan" && pts.length === 1) {
        const dx = e.clientX - g.lastX;
        const dy = e.clientY - g.lastY;

        scroller.scrollLeft -= dx;
        scroller.scrollTop -= dy;

        g.lastX = e.clientX;
        g.lastY = e.clientY;
        return;
      }

      // 2 finger pinch + pan
      if (pts.length === 2) {
        const a = pts[0];
        const b = pts[1];
        const mid = midpoint(a, b);
        const dist = distance(a, b);

        const ratio = dist / (g.startDist || dist || 1);
        const newZoom = g.startZoom * ratio;

        setZoomKeepingFocalPoint(newZoom, mid.x, mid.y);

        // also allow 2-finger pan via midpoint movement
        const midDx = mid.x - g.startMidX;
        const midDy = mid.y - g.startMidY;

        scroller.scrollLeft = g.startScrollLeft - midDx;
        scroller.scrollTop = g.startScrollTop - midDy;
      }
    },
    [setZoomKeepingFocalPoint],
  );

  const endPointer = useCallback(
    (e) => {
      const scroller = scrollerRef.current;
      if (!scroller) return;

      pointersRef.current.delete(e.pointerId);

      const pts = Array.from(pointersRef.current.values());
      const g = gestureRef.current;

      if (pts.length === 0) {
        g.mode = "none";
      } else if (pts.length === 1) {
        g.mode = "pan";
        g.lastX = pts[0].x;
        g.lastY = pts[0].y;
      } else if (pts.length === 2) {
        const a = pts[0];
        const b = pts[1];
        const mid = midpoint(a, b);

        g.mode = "pinch";
        g.startDist = distance(a, b);
        g.startZoom = zoom;
        g.startScrollLeft = scroller.scrollLeft;
        g.startScrollTop = scroller.scrollTop;
        g.startMidX = mid.x;
        g.startMidY = mid.y;
      }
    },
    [zoom],
  );

  const file = useMemo(() => (fileUrl ? { url: fileUrl } : null), [fileUrl]);

  if (!fileUrl) {
    return (
      <div className="text-center mt-8">
        <p className="text-gray-500 dark:text-gray-400">No PDF selected</p>
        {onBack && (
          <button
            onClick={onBack}
            className="mt-4 px-4 py-2 bg-[var(--mm-teal)] text-white rounded-xl hover:bg-[var(--mm-teal-dark)] transition"
          >
            Back to Notes
          </button>
        )}
      </div>
    );
  }

  // IMPORTANT: spacer size grows for scrollbars, but inner content is ONLY transformed
  const spacerW = basePageWidth ? Math.floor(basePageWidth * scale) : undefined;
  const spacerH = basePageHeight
    ? Math.floor(basePageHeight * scale)
    : undefined;

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="px-3 py-1 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              ← Back
            </button>
          )}
          <h2 className="text-xl lg:text-2xl font-semibold">PDF Viewer</h2>
        </div>

        {/* Page navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={prevPage}
            disabled={!numPages || currentPage <= 1}
            className="px-3 py-1 border rounded-lg disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            aria-label="Previous page"
          >
            ◀
          </button>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              goToPage();
            }}
            className="flex items-center gap-2"
          >
            <span className="text-sm font-medium">Page</span>
            <input
              value={pageInput}
              onChange={(e) =>
                setPageInput(e.target.value.replace(/[^\d]/g, ""))
              }
              onBlur={goToPage}
              inputMode="numeric"
              pattern="[0-9]*"
              className="w-16 px-2 py-1 border rounded-lg text-sm text-center bg-white dark:bg-gray-900"
              aria-label="Page number"
            />
            <span className="text-sm font-medium">/ {numPages ?? "—"}</span>
            <button
              type="submit"
              disabled={!numPages}
              className="px-3 py-1 border rounded-lg disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              aria-label="Go to page"
              title="Go"
            >
              Go
            </button>
          </form>

          <button
            onClick={nextPage}
            disabled={!numPages || currentPage >= (numPages || 1)}
            className="px-3 py-1 border rounded-lg disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            aria-label="Next page"
          >
            ▶
          </button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            className="px-3 py-1 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="text-sm font-medium w-12 text-center">
            {Math.round(zoom)}%
          </span>
          <button
            onClick={zoomIn}
            className="px-3 py-1 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={resetZoom}
            className="px-3 py-1 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            aria-label="Reset zoom"
            title="Reset zoom (100%)"
          >
            100%
          </button>
        </div>
      </div>

      {/* FIXED CONTAINER */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-2xl border border-gray-200 dark:border-gray-800 shadow-soft bg-white dark:bg-gray-900"
        style={{
          height: "75vh",
          overflow: "auto",
          WebkitOverflowScrolling: "touch",

          // We fully control gestures so the container itself never zooms
          touchAction: "none",
          userSelect: "none",
        }}
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={endPointer}
      >
        <div className="p-4">
          <Document
            file={file}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={<div className="text-gray-500">Loading PDF…</div>}
            error={
              <div className="text-red-500 space-y-2 text-center">
                <div>Failed to load PDF.</div>
                {loadError && (
                  <div className="text-xs opacity-70 break-all">
                    {String(loadError)}
                  </div>
                )}
              </div>
            }
          >
            {/* Spacer controls scrollable size (grows with zoom) */}
            <div
              className="inline-block align-top"
              style={{
                width: spacerW ? `${spacerW}px` : undefined,
                height: spacerH ? `${spacerH}px` : undefined,
              }}
            >
              {/* Inner content is only transformed (NO width/height scaling here) */}
              <div
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: "0 0",
                  width: basePageWidth ? `${basePageWidth}px` : undefined,
                  height: basePageHeight ? `${basePageHeight}px` : undefined,
                }}
              >
                <Page
                  pageNumber={currentPage}
                  width={baseWidth} // render sharp at base width (100%)
                  renderTextLayer={false}
                  renderAnnotationLayer={true}
                  onRenderSuccess={onPageRenderSuccess}
                />
              </div>
            </div>
          </Document>

          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            1 finger = scroll, 2 fingers = pinch zoom (container stays fixed).
          </div>
        </div>
      </motion.div>

      {/* Prevent canvas from being forced to fit */}
      <style jsx global>{`
        .react-pdf__Page {
          max-width: none !important;
        }
        .react-pdf__Page__canvas {
          max-width: none !important;
          height: auto !important;
          display: block;
        }
        canvas.react-pdf__Page__canvas {
          max-width: none !important;
        }
      `}</style>
    </section>
  );
}
