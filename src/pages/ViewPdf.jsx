import { useState } from "react";
import { motion } from "framer-motion";

export default function ViewPdf({ fileName, onBack }) {
  const [zoom, setZoom] = useState(100); // zoom 50-200%

  if (!fileName)
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

  const pdfUrl = `${fileName}`;
  console.log("Viewing PDF:", pdfUrl);
  const zoomIn = () => setZoom((z) => Math.min(z + 10, 200));
  const zoomOut = () => setZoom((z) => Math.max(z - 10, 50));

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
          >
            −
          </button>
          <span className="text-sm font-medium w-12 text-center">{zoom}%</span>
          <button
            onClick={zoomIn}
            className="px-3 py-1 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            +
          </button>
        </div>
      </div>

      {/* PDF Container */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-soft bg-white dark:bg-gray-900 flex justify-center items-start"
        style={{ height: "75vh", overflow: "auto" }}
      >
        <iframe
          title="PDF Viewer"
          src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1`}
          className="w-full h-full origin-top-left transition-transform duration-150"
          style={{ transform: `scale(${zoom / 100})` }}
        />
      </motion.div>
    </section>
  );
}
