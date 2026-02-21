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
        {
          title,
          content,
        },
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

  return (
    <section className="max-w-lg mx-auto mt-10 space-y-6">
      <h2 className="text-2xl font-semibold">Add Announcement</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col">
          <label className="text-sm mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--mm-teal)]"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm mb-1">Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--mm-teal)]"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-[var(--mm-teal)] text-white py-2 px-4 rounded-lg hover:bg-teal-700 transition"
        >
          {loading ? "Adding..." : "Add Announcement"}
        </button>
      </form>
    </section>
  );
}
