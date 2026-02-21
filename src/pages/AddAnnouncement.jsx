import { useState } from "react";
import axios from "axios";

export default function AddAnnouncement() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !content) {
      alert("Title and content are required");
      return;
    }

    try {
      setLoading(true);
      await axios.post(
        "https://ugliest-hannie-ezaz-307892de.koyeb.app/api/announcements",
        { title, content },
      );
      alert("Announcement added!");
      setTitle("");
      setContent("");
    } catch (err) {
      console.error(err);
      alert("Failed to add announcement");
    } finally {
      setLoading(false);
    }
  };

  // Inline Spinner (no external files)
  const Spinner = ({ className = "w-5 h-5 text-white" }) => (
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

  return (
    <section className="max-w-lg mx-auto mt-10 space-y-6" aria-busy={loading}>
      <h2 className="text-2xl font-semibold">Add Announcement</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col">
          <label className="text-sm mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={loading}
            className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--mm-teal)] disabled:opacity-60"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm mb-1">Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            disabled={loading}
            className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--mm-teal)] disabled:opacity-60"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 bg-[var(--mm-teal)] text-white py-2 px-4 rounded-lg hover:bg-[var(--mm-teal-dark)] transition disabled:opacity-60"
        >
          {loading ? (
            <>
              <Spinner />
              Adding...
            </>
          ) : (
            "Add Announcement"
          )}
        </button>
      </form>
    </section>
  );
}
