import { useState } from "react";

function Spinner({ className = "w-5 h-5 text-white" }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

export default function UploadPdf({ user }) {
  const [file, setFile] = useState(null);
  const [noteName, setNoteName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected && selected.type === "application/pdf") {
      setFile(selected);
      setMessage("");
    } else {
      setFile(null);
      setMessage("Please select a PDF file.");
    }
  };

  const handleUpload = async () => {
    if (!file) return setMessage("No file selected.");
    if (!noteName.trim()) return setMessage("Please enter a note name.");

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("noteName", noteName);
      formData.append("isPublic", isPublic);
      if (user?.uid) formData.append("uploadedBy", user.uid);

      const res = await fetch(
        "https://ugliest-hannie-ezaz-307892de.koyeb.app/api/upload",
        {
          method: "POST",
          body: formData,
        },
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload failed.");

      setMessage(`File "${data.note.noteName}" uploaded successfully!`);
      setFile(null);
      setNoteName("");
      setIsPublic(false);
    } catch (err) {
      console.error(err);
      setMessage(err.message || "Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold text-center">Upload PDF</h2>

      {/* Note Name Input */}
      <div className="max-w-xs mx-auto">
        <input
          type="text"
          value={noteName}
          onChange={(e) => setNoteName(e.target.value)}
          placeholder="Enter note name"
          disabled={loading}
          className="w-full px-3 py-2 border rounded-xl border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mm-teal)] disabled:opacity-60"
        />
      </div>

      {/* Upload Box */}
      <label
        className={`cursor-pointer block w-full max-w-xs mx-auto ${loading ? "pointer-events-none opacity-60" : ""}`}
      >
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="hidden"
          disabled={loading}
        />
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl h-40 bg-gray-50 dark:bg-gray-900 hover:border-[var(--mm-teal)] transition relative">
          {!file ? (
            <>
              <span className="text-4xl text-[var(--mm-teal)] font-bold">
                +
              </span>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                Tap to select PDF
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-700 dark:text-gray-300 text-center px-4">
              Selected: <strong>{file.name}</strong>
            </p>
          )}
        </div>
      </label>

      {/* Public Toggle */}
      <div className="flex items-center justify-center gap-2">
        <input
          type="checkbox"
          id="publicPdf"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          disabled={loading}
          className="w-4 h-4 accent-[var(--mm-teal)]"
        />
        <label
          htmlFor="publicPdf"
          className="text-sm text-gray-600 dark:text-gray-300"
        >
          Make PDF public
        </label>
      </div>

      {/* Message */}
      {message && (
        <p
          className={`text-sm text-center ${
            message.includes("successfully") ? "text-green-500" : "text-red-500"
          }`}
        >
          {message}
        </p>
      )}

      {/* Upload Button */}
      <div className="text-center">
        <button
          onClick={handleUpload}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--mm-teal)] text-white py-2 px-6 font-medium shadow hover:bg-[var(--mm-teal-dark)] transition disabled:opacity-60"
        >
          {loading ? (
            <>
              <Spinner />
              Uploading...
            </>
          ) : (
            "Upload"
          )}
        </button>
      </div>
    </div>
  );
}
``;
