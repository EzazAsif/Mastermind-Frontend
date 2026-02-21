// ViewPdf.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Document, Page, pdfjs } from "react-pdf";

// Required CSS for annotations (fixes the warning)
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
// Enable if you want selectable text:
// import "react-pdf/dist/esm/Page/TextLayer.css";

// PDF.js worker from CDN
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

export default function ViewPdf({ fileName, onBack }) {
  // fileName is the FULL streaming URL
  const fileUrl = fileName;

  const [zoom, setZoom] = useState(100); // 50–200%
  const [numPages, setNumPages] = useState(null);
  const [containerWidth, setContainerWidth] = useState(null);
  const [loadError, setLoadError] = useState(null);

  // Observe the scroll container width
  const roRef = useRef(null);
  const containerRef = useCallback((node) => {
    if (!node) return;
    const padding = 32; // p-4 below
    const update = () => setContainerWidth(node.clientWidth - padding);

    update();
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(update);
    });
    ro.observe(node);
    roRef.current = ro;
  }, []);
  useEffect(() => () => roRef.current?.disconnect(), []);

  const onDocumentLoadSuccess = ({ numPages: n }) => {
    setNumPages(n);
    setLoadError(null);
  };
  const onDocumentLoadError = (err) => {
    console.error("PDF load error:", err);
    setLoadError(err?.message || "Failed to load PDF");
  };

  const zoomIn = () => setZoom((z) => Math.min(z + 10, 200));
  const zoomOut = () => setZoom((z) => Math.max(z - 10, 50));
  const resetZoom = () => setZoom(100);

  // Width logic:
  // - zoom <= 100: fit-to-width (no tiny block)
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
      {/* Header with Zoom and Back */}
      <div className="flex items-center justify-between">
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
          // Ensure gestures are recognized for horizontal pan on mobile
          touchAction: "pan-x pan-y",
        }}
        ref={containerRef}
      >
        {/* CONTENT TRACK:
            - Avoid w-full that clamps width
            - Use min-w-full so at <=100% zoom it fits nicely
            - Allow width to grow when >100% zoom
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
            {Array.from(new Array(numPages || 0), (_el, i) => (
              <div
                key={`page_${i + 1}`}
                // IMPORTANT:
                //  - inline-block lets the element exceed container width
                //  - remove any max-width clamps
                className="mb-4 inline-block align-top"
                style={{
                  // Let this wrapper grow beyond the container when zoomed in
                  width: computedPageWidth
                    ? `${computedPageWidth}px`
                    : undefined,
                }}
              >
                <Page
                  pageNumber={i + 1}
                  width={computedPageWidth}
                  renderTextLayer={false}
                  renderAnnotationLayer={true}
                />
              </div>
            ))}
          </Document>

          {/* Fallback link */}
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

      {/* CSS OVERRIDES (crucial for horizontal scroll) */}
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
        /* Some builds apply max-width: 100% to images/canvas globally; negate that here */
        canvas.react-pdf__Page__canvas {
          max-width: none !important;
        }
      `}</style>
    </section>
  );
}
``;
