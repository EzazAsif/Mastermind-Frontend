// ViewPdf.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Document, Page, pdfjs } from "react-pdf";

import "react-pdf/dist/esm/Page/AnnotationLayer.css";
// import "react-pdf/dist/esm/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

function getTouchDist(touches) {
  if (!touches || touches.length < 2) return null;
  const [a, b] = touches;
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

export default function ViewPdf({ fileName, onBack }) {
  const fileUrl = fileName;

  const initialZoom =
    typeof window !== "undefined" && window.innerWidth < 640 ? 120 : 100;

  const [zoom, setZoom] = useState(initialZoom); // 50–300%
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [containerWidth, setContainerWidth] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const [pageInput, setPageInput] = useState("1");

  // Resize observer
  const roRef = useRef(null);
  const containerRef = useCallback((node) => {
    if (!node) return;
    const padding = 32; // p-4
    const update = () => setContainerWidth(node.clientWidth - padding);
    update();
    const ro = new ResizeObserver(() => requestAnimationFrame(update));
    ro.observe(node);
    roRef.current = ro;
  }, []);
  useEffect(() => () => roRef.current?.disconnect(), []);

  const onDocumentLoadSuccess = ({ numPages: n }) => {
    setNumPages(n);
    setCurrentPage(1);
    setPageInput("1");
    setLoadError(null);
  };
  const onDocumentLoadError = (err) => {
    console.error("PDF load error:", err);
    setLoadError(err?.message || "Failed to load PDF");
  };

  const zoomIn = () => setZoom((z) => Math.min(z + 10, 300));
  const zoomOut = () => setZoom((z) => Math.max(z - 10, 50));
  const resetZoom = () => setZoom(100);

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

  // Width logic:
  // - zoom ≤ 100: fit-to-width
  // - zoom > 100: allow width > container => horizontal scroll
  const computedPageWidth = useMemo(() => {
    if (!containerWidth) return undefined;
    if (zoom <= 100) return Math.floor(containerWidth);
    return Math.floor((containerWidth * zoom) / 100);
  }, [containerWidth, zoom]);

  const file = useMemo(() => (fileUrl ? { url: fileUrl } : null), [fileUrl]);

  // ---------------------------
  // Pinch-to-zoom (manual fallback)
  // ---------------------------
  const isPinchingRef = useRef(false);
  const startDistRef = useRef(null);
  const startZoomRef = useRef(100);

  const onTouchStart = useCallback(
    (e) => {
      if (e.touches?.length === 2) {
        isPinchingRef.current = true;
        startDistRef.current = getTouchDist(e.touches);
        startZoomRef.current = zoom;
        // Don’t preventDefault here; allow browser native pinch where supported.
      }
    },
    [zoom],
  );

  const onTouchMove = useCallback((e) => {
    if (!isPinchingRef.current) return;
    if (e.touches?.length !== 2) return;

    const dist = getTouchDist(e.touches);
    const startDist = startDistRef.current;
    if (!dist || !startDist) return;

    // ratio-based zoom: newZoom = startZoom * (dist / startDist)
    const ratio = dist / startDist;
    const nextZoom = Math.max(50, Math.min(300, Math.round(startZoomRef.current * ratio)));

    setZoom(nextZoom);

    // In some Android WebViews, native pinch won’t work with custom handlers.
    // Prevent default to avoid scroll-jank while pinching.
    e.preventDefault?.();
  }, []);

  const onTouchEnd = useCallback((e) => {
    if (e.touches?.length < 2) {
      isPinchingRef.current = false;
      startDistRef.current = null;
    }
  }, []);

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

        {/* Page nav */}
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
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d]/g, "");
                setPageInput(v);
              }}
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

        {/* Zoom buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            className="px-3 py-1 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="text-sm font-medium w-12 text-center">{zoom}%</span>
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

      {/* SCROLL CONTAINER */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-2xl border border-gray-200 dark:border-gray-800 shadow-soft bg-white dark:bg-gray-900"
        style={{
          height: "75vh",
          overflowX: "auto",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",

          // ✅ Allow browser pinch zoom + panning
          // Your previous "pan-x pan-y" blocks pinch on many browsers.
          touchAction: "pinch-zoom",
        }}
        ref={containerRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
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
            <div
              className="inline-block align-top"
              style={{
                width: computedPageWidth ? `${computedPageWidth}px` : undefined,
              }}
            >
              <Page
                pageNumber={currentPage}
                width={computedPageWidth}
                renderTextLayer={false}
                renderAnnotationLayer={true}
              />
            </div>
          </Document>
        </div>
      </motion.div>

      {/* CSS OVERRIDES */}
      <style jsx global>{`
        .react-pdf__Page {
          max-width: none !important;
        }
        .react-pdf__Page__canvas {
          max-width: none !important;
          width: 100% !important;
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
