import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import axios from "axios";

// Modals
import AuthModal from "../components/AuthModal.jsx";
import ValidationModal from "../components/ValidationModal.jsx";

/**
 * Create a per-session stable key for objects that may not have a stable id.
 */
function createStableKeyFactory() {
  const wm = new WeakMap();
  let counter = 0;

  return function getStableKey(note) {
    if (note?._id) return String(note._id);
    if (note?.id) return String(note.id);
    if (note?.fileId) return String(note.fileId);

    if (note?.fileName && note?.originalName) {
      return `file:${note.fileName}|orig:${note.originalName}`;
    }
    if (note?.fileName) return `file:${note.fileName}`;

    if (!wm.has(note)) wm.set(note, `session-${++counter}`);
    return wm.get(note);
  };
}
const getStableKey = createStableKeyFactory();

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

export default function Notes({ openPdf, currentUser, locale }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // dbUser like Header (contains is_validated, request_sent etc.)
  const [dbUser, setDbUser] = useState(null);

  // local modals (no parent props needed)
  const [loginOpen, setLoginOpen] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);

  const API_BASE =
    import.meta.env.VITE_API_URL ||
    "https://ugliest-hannie-ezaz-307892de.koyeb.app";

  // Fetch notes (must return both free + premium)
  const fetchNotes = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      params.set("limit", "60");

      // if you want the backend to know who is requesting:
      if (currentUser?.uid) params.set("uid", currentUser.uid);

      const res = await fetch(`${API_BASE}/api/notes?${params.toString()}`);

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
      console.error("Notes fetch error:", e);
      setError(e.message || "Something went wrong.");
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [API_BASE, currentUser?.uid]);

  // Fetch dbUser (same as Header)
  const fetchDbUser = useCallback(async () => {
    if (!currentUser?.uid) {
      setDbUser(null);
      return;
    }

    try {
      let headers = {};
      try {
        const token = await currentUser.getIdToken?.();
        if (token) headers.Authorization = `Bearer ${token}`;
      } catch {
        // optional
      }

      const res = await axios.get(`${API_BASE}/api/users/${currentUser.uid}`, {
        headers,
        timeout: 12000,
      });

      setDbUser(res?.data || null);
    } catch (err) {
      console.error("Failed to fetch DB user (Notes):", err);
      setDbUser(null);
    }
  }, [API_BASE, currentUser?.uid]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  useEffect(() => {
    fetchDbUser();
  }, [fetchDbUser]);

  const normalizedNotes = useMemo(() => {
    return [...notes]
      .sort((a, b) => {
        const nameA = (a.noteName || a.originalName || "").toLowerCase();
        const nameB = (b.noteName || b.originalName || "").toLowerCase();
        return nameA.localeCompare(nameB);
      })
      .map((n) => ({ ...n, stableKey: getStableKey(n) }));
  }, [notes]);

  const isValidated = !!dbUser?.is_validated;

  const handleNoteClick = useCallback(
    (note) => {
      const hasUrl = !!note?.downloadURL;
      if (!hasUrl) return;

      const isFree = !!note?.isPublic; // your backend field

      // ✅ Free opens always
      if (isFree) {
        openPdf?.(note.downloadURL);
        return;
      }

      // 🔒 Premium gating
      if (!currentUser) {
        // not logged in
        setLoginOpen(true);
        return;
      }

      if (!isValidated) {
        // logged in but not validated
        setValidationOpen(true);
        return;
      }

      // validated
      openPdf?.(note.downloadURL);
    },
    [openPdf, currentUser, isValidated],
  );

  if (loading) return <p className="text-center mt-4">Loading notes...</p>;
  if (error) return <p className="text-center mt-4 text-red-500">{error}</p>;
  if (!normalizedNotes.length)
    return <p className="text-center mt-4">No notes available.</p>;

  return (
    <>
      <section className="space-y-6">
        <h2 className="text-xl lg:text-2xl font-semibold">My Notes</h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {normalizedNotes.map((note) => {
            const hasUrl = !!note.downloadURL;
            const isFree = !!note.isPublic;

            return (
              <motion.div
                key={note.stableKey}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={`rounded-2xl p-[1px] bg-gradient-to-r from-teal-500 to-orange-500 ${
                  hasUrl
                    ? "hover:shadow-lg cursor-pointer"
                    : "opacity-80 cursor-not-allowed"
                }`}
                onClick={() => hasUrl && handleNoteClick(note)}
                title={
                  !hasUrl
                    ? "No file URL available"
                    : isFree
                      ? "Open (Free)"
                      : "Open (Premium)"
                }
              >
                <div className="rounded-2xl bg-white dark:bg-gray-900 p-5 shadow-soft transition group">
                  <div className="flex items-start justify-between">
                    <div className="p-2 rounded-xl bg-[var(--mm-teal)]/10 text-[var(--mm-teal)] text-lg">
                      📓
                    </div>

                    {/* Free/Premium label */}
                    <div
                      className={`text-xs font-medium px-2 py-1 rounded-full ${
                        isFree
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      }`}
                    >
                      {isFree ? "Free" : "Premium"}
                    </div>
                  </div>

                  <h3 className="mt-4 font-medium text-sm lg:text-base group-hover:text-[var(--mm-teal)] transition">
                    {note.noteName || note.originalName || "Untitled"}
                  </h3>

                  {!isFree ? (
                    <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                      {!currentUser
                        ? "Tap to log in"
                        : !isValidated
                          ? "Tap to validate"
                          : "Tap to open"}
                    </p>
                  ) : null}
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ✅ Login modal (same UI style as your app) */}
      <AuthModal open={loginOpen} onClose={() => setLoginOpen(false)} />

      {/* ✅ Validation modal (same component you already have) */}
      <ValidationModal
        isOpen={validationOpen}
        onClose={() => setValidationOpen(false)}
        onSuccess={() => {
          // refresh validation state after submitting
          setValidationOpen(false);
          fetchDbUser();
        }}
      />
    </>
  );
}
