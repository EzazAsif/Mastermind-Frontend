// ViewPdf.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Document, Page, pdfjs } from "react-pdf";

// 1) FIX THE WARNING: include annotation/text layer styles
//    If your bundler doesn't support ESM CSS, see notes below for alternative import paths.
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

// 2) PDF.js worker from CDN (works in Android Chrome/WebView)
//    If you want offline, self-host the worker and import its URL instead.
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

export default function ViewPdf({ fileName, onBack }) {
  // fileName is actually the full streaming URL
  const fileUrl = fileName;

  const [zoom, setZoom] = useState(100); // 50–200%
  const [numPages, setNumPages] = useState(null); // total pages after load
  const [containerWidth, setContainerWidth] = useState(null);
  const [loadError, setLoadError] = useState(null);

  // ResizeObserver with cleanup
  const roRef = useRef(null);
  const containerRef = useCallback((node) => {
    if (!node) return;
    const padding = 32; // matches inner padding below
    const update = () => setContainerWidth(node.clientWidth - padding);

    update();
    const ro = new ResizeObserver(() => {
      // rAF to avoid thrash during rapid resizes/rotation
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

  // Pass as object for future options (e.g., headers/credentials)
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

      {/* PDF Container */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-2xl overflow-auto border border-gray-200 dark:border-gray-800 shadow-soft bg-white dark:bg-gray-900 flex justify-center items-start"
        style={{ height: "75vh" }}
        ref={containerRef}
      >
        <div className="p-4 w-full flex flex-col items-center">
          <Document
            file={file}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={<div className="text-gray-500">Loading PDF…</div>}
            error={
              <div className="text-red-500 space-y-2 text-center">
                <div>Failed to load PDF.</div>
                {loadError && (
                  <div className="text-xs opacity-70">{String(loadError)}</div>
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
            {/* Render all pages. For very long PDFs, consider virtualization. */}
            {Array.from(new Array(numPages || 0), (_el, i) => (
              <div key={`page_${i + 1}`} className="mb-4 flex justify-center">
                <Page
                  pageNumber={i + 1}
                  // Use width-based sizing for responsiveness + zoom:
                  width={
                    containerWidth
                      ? Math.floor((containerWidth * zoom) / 100)
                      : undefined
                  }
                  // PERFORMANCE: keep text layer off unless you need selectable text
                  renderTextLayer={false}
                  // Keep annotation layer on for links/forms; CSS imports above remove the warning
                  renderAnnotationLayer={true}
                />
              </div>
            ))}
          </Document>

          {/* Open in new tab fallback for odd WebViews */}
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
    </section>
  );
}
