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
    if (note?._id) return String(note._id);
    if (note?.id) return String(note.id);
    if (note?.fileId) return String(note.fileId);

    // 2) Composite keys from immutable fields
    if (note?.fileName && note?.originalName) {
      return `file:${note.fileName}|orig:${note.originalName}`;
    }
    if (note?.fileName) {
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

/** Robust date conversion (supports Firestore Timestamp / {seconds} / string / Date) */
function safeToDate(input, fallback = new Date(0)) {
  try {
    if (!input) return fallback;
    if (typeof input === "object") {
      if (typeof input.toDate === "function") {
        const d = input.toDate();
        return isNaN(d?.getTime()) ? fallback : d;
      }
      if (typeof input.seconds === "number") {
        const d = new Date(input.seconds * 1000);
        return isNaN(d.getTime()) ? fallback : d;
      }
    }
    const d = new Date(input);
    return isNaN(d.getTime()) ? fallback : d;
  } catch {
    return fallback;
  }
}

function safeToLocaleDateString(input, locale) {
  try {
    return safeToDate(input, new Date()).toLocaleDateString(locale);
  } catch {
    const d = safeToDate(input, new Date());
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
  }
}

export default function Notes({ openPdf, locale }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const baseApi =
    import.meta.env.VITE_API_URL ||
    "https://ugliest-hannie-ezaz-307892de.koyeb.app";

  // Fetch notes once we know the current firebaseUser (or guest)
  const fetchNotes = useCallback(
    async (firebaseUser, signal) => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams();
        // Optional: add a limit if your backend supports it
        params.set("limit", "30");

        let headers = {};
        if (firebaseUser) {
          params.set("uid", firebaseUser.uid);
          try {
            // Attach ID token if your API requires auth for user-specific notes
            const token = await firebaseUser.getIdToken();
            if (token) {
              headers = { Authorization: `Bearer ${token}` };
            }
          } catch (e) {
            console.warn("Failed to get ID token (continuing without):", e);
          }
        }

        const url = `${baseApi}/api/notes?${params.toString()}`;
        const res = await fetch(url, { headers, signal });

        if (!res.ok) {
          let message = `Failed to fetch notes (${res.status})`;
          try {
            const data = await res.json();
            if (data?.message) message = data.message;
          } catch {}
          throw new Error(message);
        }

        const data = await res.json();
        setNotes(Array.isArray(data) ? data : []);
      } catch (e) {
        if (e.name === "AbortError") return; // cancelled
        console.error("Notes fetch error:", e);
        setError(e.message || "Something went wrong.");
        setNotes([]);
      } finally {
        setLoading(false);
      }
    },
    [baseApi],
  );

  // Avoid Strict Mode double-run races with AbortController
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      // Let the API decide visibility:
      // - validated user -> user notes
      // - not validated/guest -> public notes
      fetchNotes(firebaseUser, signal);
    });

    return () => {
      controller.abort();
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
        {normalizedNotes.map((note) => {
          const hasUrl = !!note.downloadURL;
          return (
            <motion.div
              key={note.stableKey}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 shadow-soft transition group ${
                hasUrl
                  ? "hover:shadow-lg cursor-pointer"
                  : "opacity-80 cursor-not-allowed"
              }`}
              onClick={() => hasUrl && openPdf && openPdf(note.downloadURL)}
              title={hasUrl ? "Open PDF" : "No file URL available"}
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
                {note.noteName || note.originalName || "Untitled"}
              </h3>

              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Uploaded on {safeToLocaleDateString(note.createdAt, locale)}
              </p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
