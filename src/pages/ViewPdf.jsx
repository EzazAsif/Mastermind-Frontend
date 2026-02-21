import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { motion } from "framer-motion";

// ✅ pdfjs-dist v3 worker (matches your package.json 3.11.174)
import workerSrc from "pdfjs-dist/build/pdf.worker.min.js?url";
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

/**
 * Convert a direct Google Storage URL into a Vite-proxied path
 * so the browser calls same-origin /pdf/... (no CORS during dev).
 *
 * Example:
 *   https://storage.googleapis.com/<bucket>/<object>?query
 * -> /pdf/<bucket>/<object>?query
 */
function toProxiedUrl(storageUrl) {
  try {
    const u = new URL(storageUrl);
    if (u.hostname === "storage.googleapis.com") {
      return `/pdf${u.pathname}${u.search}`;
    }
    // If you also use the alternate host (<bucket>.storage.googleapis.com),
    // add a case here and ensure Vite proxies that host as well.
    return storageUrl;
  } catch {
    return storageUrl;
  }
}

export default function ViewPdf({ fileName, onBack }) {
  const [numPages, setNumPages] = useState(0);
  const [renderingError, setRenderingError] = useState(null);

  // Track container width to auto-fit pages for mobile readability
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(Math.floor(entry.contentRect.width));
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Memoize options to avoid unnecessary reload warnings
  const pdfOptions = useMemo(
    () => ({
      // Match the installed pdfjs-dist version
      cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/",
      cMapPacked: true,
      // If you need Type1 fonts:
      // standardFontDataUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/"
    }),
    [],
  );

  const onDocumentLoadSuccess = ({ numPages: n }) => {
    setNumPages(n);
    setRenderingError(null);
  };

  const onDocumentLoadError = (err) => {
    console.error("PDF load error:", err);
    setRenderingError("We couldn't render this PDF on your device.");
  };

  if (!fileName) {
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

  // Route GCS URLs through Vite proxy in dev to avoid CORS
  const proxiedFileName = toProxiedUrl(fileName);

  return (
    <section className="space-y-4 select-none">
      {/* Header */}
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
      </div>

      {/* Tight continuous scroll container (no iframe => no native download UI) */}
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-2xl overflow-auto border border-gray-200 dark:border-gray-800 shadow-soft bg-white dark:bg-gray-900"
        style={{ height: "75vh" }}
        onContextMenu={(e) => e.preventDefault()} // discourage context menu save
      >
        {/* Remove extra padding/gaps for tight spacing */}
        <div className="flex flex-col items-center">
          <Document
            file={proxiedFileName}
            options={pdfOptions}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={<div className="p-4 text-gray-500">Loading PDF…</div>}
            error={
              <div className="p-4 text-red-600">
                {renderingError ?? "Failed to load PDF."}
              </div>
            }
          >
            {/* Render all pages (continuous) with minimal spacing */}
            {numPages > 0 && (
              <div className="w-full flex flex-col items-center">
                {Array.from({ length: numPages }, (_, i) => (
                  <Page
                    key={`p-${i + 1}`}
                    pageNumber={i + 1}
                    // Fit to container width; no extra padding
                    width={containerWidth || undefined}
                    renderTextLayer={false} // better perf on Android
                    renderAnnotationLayer={true} // keep links
                    className="mb-1 last:mb-0" // tiny gap between pages (4px); adjust to taste
                  />
                ))}
              </div>
            )}
          </Document>
        </div>
      </motion.div>
    </section>
  );
}
