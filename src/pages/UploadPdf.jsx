import { useState } from "react";

export default function UploadPdf({ user }) {
  // user: optional, can pass Firebase UID for uploadedBy
  const [file, setFile] = useState(null);
  const [noteName, setNoteName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Handle file selection
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

  // Handle upload to backend
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
          className="w-full px-3 py-2 border rounded-xl border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mm-teal)]"
        />
      </div>

      {/* Upload Box */}
      <label className="cursor-pointer block w-full max-w-xs mx-auto">
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="hidden"
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
          className={`text-sm text-center ${message.includes("successfully") ? "text-green-500" : "text-red-500"}`}
        >
          {message}
        </p>
      )}

      {/* Upload Button */}
      <div className="text-center">
        <button
          onClick={handleUpload}
          disabled={loading}
          className="rounded-xl bg-[var(--mm-teal)] text-white py-2 px-6 font-medium shadow hover:bg-[var(--mm-teal-dark)] transition disabled:opacity-60"
        >
          {loading ? "Uploading..." : "Upload"}
        </button>
      </div>
    </div>
  );
}
