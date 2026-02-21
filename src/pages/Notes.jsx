import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";

/**
 * Create a per-session stable key for objects that may not have a stable id.
 * - Prefer backend ids (_id, id, fileId).
 * - Then try a composite from immutable backend fields.
 * - Finally, assign an incrementing session id stored in a WeakMap (stable for the same object instance).
 */
function createStableKeyFactory() {
  const wm = new WeakMap();
  let counter = 0;

  return function getStableKey(note) {
    // 1) Prefer true IDs that come from the backend and won't change
    if (note._id) return String(note._id);
    if (note.id) return String(note.id);
    if (note.fileId) return String(note.fileId);

    // 2) Composite keys from immutable fields (only if you’re sure they won’t change)
    // Avoid using createdAt unless guaranteed immutable & consistent across fetches.
    if (note.fileName && note.originalName) {
      return `file:${note.fileName}|orig:${note.originalName}`;
    }
    if (note.fileName) {
      return `file:${note.fileName}`;
    }

    // 3) Session-stable fallback via WeakMap (last resort)
    if (!wm.has(note)) {
      wm.set(note, `session-${++counter}`);
    }
    return wm.get(note);
  };
}

const getStableKey = createStableKeyFactory();

export default function Notes({ openPdf }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const baseApi =
    import.meta.env.VITE_API_URL ||
    "https://ugliest-hannie-ezaz-307892de.koyeb.app";

  // Fetch notes once we know the current firebaseUser (or guest)
  const fetchNotes = useCallback(
    async (firebaseUser) => {
      setLoading(true);
      setError("");

      try {
        // Build URL based on whether we have a logged-in user
        const url = firebaseUser
          ? `${baseApi}/api/notes?uid=${encodeURIComponent(firebaseUser.uid)}`
          : `${baseApi}/api/notes`;

        const res = await fetch(url);
        if (!res.ok) {
          let message = "Failed to fetch notes.";
          try {
            const data = await res.json();
            if (data?.message) message = data.message;
          } catch {}
          throw new Error(message);
        }

        const data = await res.json();
        setNotes(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Notes fetch error:", e);
        setError(e.message || "Something went wrong.");
        setNotes([]);
      } finally {
        setLoading(false);
      }
    },
    [baseApi],
  );

  useEffect(() => {
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (cancelled) return;
      // Let the API decide visibility:
      // - validated user -> all notes
      // - not validated/guest -> public notes
      fetchNotes(firebaseUser);
    });

    return () => {
      cancelled = true;
      try {
        unsub && unsub();
      } catch {}
    };
  }, [fetchNotes]);

  // Normalize notes once per render and attach a stable key
  const normalizedNotes = useMemo(() => {
    return notes.map((n) => ({
      ...n,
      stableKey: getStableKey(n),
    }));
  }, [notes]);

  if (loading) return <p className="text-center mt-4">Loading notes...</p>;
  if (error) return <p className="text-center mt-4 text-red-500">{error}</p>;
  if (!normalizedNotes.length)
    return <p className="text-center mt-4">No notes available.</p>;

  return (
    <section className="space-y-6">
      <h2 className="text-xl lg:text-2xl font-semibold">My Notes</h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {normalizedNotes.map((note) => (
          <motion.div
            key={note.stableKey} // ✅ stable key
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 shadow-soft hover:shadow-lg transition cursor-pointer group"
            onClick={() => openPdf(note.downloadURL)}
          >
            <div className="flex items-start justify-between">
              <div className="p-2 rounded-xl bg-[var(--mm-teal)]/10 text-[var(--mm-teal)] text-lg">
                📄
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {note.isPublic ? "🌍 Public" : "🔒 Private"}
              </div>
            </div>

            <h3 className="mt-4 font-medium text-sm lg:text-base group-hover:text-[var(--mm-teal)] transition">
              {note.noteName || note.originalName}
            </h3>

            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Uploaded on {new Date(note.createdAt).toLocaleDateString()}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
