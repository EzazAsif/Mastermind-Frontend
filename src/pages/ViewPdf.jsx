// ViewPdf.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Document, Page, pdfjs } from "react-pdf";

// Required to avoid "AnnotationLayer styles not found" warnings
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
// Enable if you want selectable text:
// import "react-pdf/dist/esm/Page/TextLayer.css";

// PDF.js worker from CDN (works in Android Chrome/WebView)
// If you need offline, self-host pdf.worker and import its URL instead.
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

export default function ViewPdf({ fileName, onBack }) {
  // fileName is your FULL streaming URL
  const fileUrl = fileName;

  // Slightly larger default on small screens so it doesn't look tiny
  const initialZoom =
    typeof window !== "undefined" && window.innerWidth < 640 ? 120 : 100;

  const [zoom, setZoom] = useState(initialZoom); // 50–300%
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [containerWidth, setContainerWidth] = useState(null);
  const [loadError, setLoadError] = useState(null);

  // Observe the scroll container width (minus padding) for responsive fit
  const roRef = useRef(null);
  const containerRef = useCallback((node) => {
    if (!node) return;
    const padding = 32; // matches p-4 below
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
    setLoadError(null);
  };
  const onDocumentLoadError = (err) => {
    console.error("PDF load error:", err);
    setLoadError(err?.message || "Failed to load PDF");
  };

  const zoomIn = () => setZoom((z) => Math.min(z + 10, 300));
  const zoomOut = () => setZoom((z) => Math.max(z - 10, 50));
  const resetZoom = () => setZoom(100);

  const prevPage = () => setCurrentPage((p) => Math.max(1, p - 1));
  const nextPage = () => setCurrentPage((p) => Math.min(numPages || 1, p + 1));

  // Width logic:
  // - zoom ≤ 100: fit-to-container width (avoids tiny centered block)
  // - zoom > 100: exceed container width to enable horizontal scroll
  const computedPageWidth = useMemo(() => {
    if (!containerWidth) return undefined;
    if (zoom <= 100) return Math.floor(containerWidth);
    return Math.floor((containerWidth * zoom) / 100);
  }, [containerWidth, zoom]);

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

  return (
    <section className="space-y-4">
      {/* Header with Back, Pager, Zoom */}
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

        <div className="flex items-center gap-2">
          <button
            onClick={prevPage}
            disabled={!numPages || currentPage <= 1}
            className="px-3 py-1 border rounded-lg disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            aria-label="Previous page"
          >
            ◀
          </button>
          <span className="text-sm font-medium">
            {currentPage}/{numPages ?? "—"}
          </span>
          <button
            onClick={nextPage}
            disabled={!numPages || currentPage >= (numPages || 1)}
            className="px-3 py-1 border rounded-lg disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            aria-label="Next page"
          >
            ▶
          </button>
        </div>

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
          // Allow horizontal and vertical panning on mobile
          touchAction: "pan-x pan-y",
        }}
        ref={containerRef}
      >
        {/* CONTENT:
            - We render ONLY ONE PAGE (currentPage)
            - Wrapper uses explicit width to grow beyond container at >100% zoom (enables horizontal scroll)
            - We avoid w-full clamps
        */}
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
                <div className="text-sm text-gray-500">
                  Can’t see the PDF?{" "}
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--mm-teal)] underline"
                  >
                    Open in new tab
                  </a>
                </div>
              </div>
            }
          >
            {/* Single page */}
            <div
              // inline-block allows exceeding container width
              className="inline-block align-top"
              style={{
                width: computedPageWidth ? `${computedPageWidth}px` : undefined,
              }}
            >
              <Page
                pageNumber={currentPage}
                width={computedPageWidth}
                renderTextLayer={false} // perf: off unless you need selectable text
                renderAnnotationLayer={true} // needs AnnotationLayer.css (imported above)
              />
            </div>
          </Document>

          {/* Fallback link for odd WebViews */}
          <div className="text-xs text-gray-500 mt-2">
            Having trouble?{" "}
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--mm-teal)] underline"
            >
              Open PDF in a new tab
            </a>
          </div>
        </div>
      </motion.div>

      {/* CSS OVERRIDES: Crucial to allow width > container (horizontal scroll) */}
      <style jsx global>{`
        /* Remove width clamps that prevent horizontal overflow when zoomed in */
        .react-pdf__Page {
          max-width: none !important;
        }
        .react-pdf__Page__canvas {
          max-width: none !important;
          width: 100% !important; /* let the wrapper control width */
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
