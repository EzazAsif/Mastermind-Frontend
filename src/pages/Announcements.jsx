// Announcements.jsx
import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import { auth } from "../lib/firebase";

/* ---------- Stable key helpers ---------- */
function djb2(str = "") {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

function stableAnnouncementId(a) {
  if (a?._id) return String(a._id);
  if (a?.id) return String(a.id);

  const base = [
    a?.title ?? "",
    a?.content ?? "",
    a?.createdAt ? JSON.stringify(a.createdAt) : "",
  ].join("||");

  return `ann-${djb2(base)}`;
}
/* --------------------------------------- */

/** Safe date converter for Firestore Timestamp / {seconds} / {_seconds} / Mongo {$date} / nested / string / number / Date */
function safeToDate(input, fallback = null) {
  try {
    if (!input) return fallback;

    // Already a Date
    if (input instanceof Date) {
      return isNaN(input.getTime()) ? fallback : input;
    }

    // Numbers: can be ms or seconds
    if (typeof input === "number") {
      const ms = input < 1e12 ? input * 1000 : input; // guess seconds vs ms
      const d = new Date(ms);
      return isNaN(d.getTime()) ? fallback : d;
    }

    // Strings: ISO/date-ish
    if (typeof input === "string") {
      const d = new Date(input);
      return isNaN(d.getTime()) ? fallback : d;
    }

    // Objects: Firestore Timestamp / serialized forms / Mongo
    if (typeof input === "object") {
      // Firestore Timestamp object
      if (typeof input.toDate === "function") {
        const d = input.toDate();
        return isNaN(d?.getTime()) ? fallback : d;
      }

      // Firestore serialized
      if (typeof input.seconds === "number") {
        const d = new Date(input.seconds * 1000);
        return isNaN(d.getTime()) ? fallback : d;
      }
      if (typeof input._seconds === "number") {
        const d = new Date(input._seconds * 1000);
        return isNaN(d.getTime()) ? fallback : d;
      }

      // Mongo extended JSON: { $date: "..." } or { $date: 1710000000000 }
      if (input.$date != null) {
        return safeToDate(input.$date, fallback);
      }

      // Some APIs nest date
      if (input.date != null) {
        return safeToDate(input.date, fallback);
      }

      // Some APIs use createdAt: { value: "..." }
      if (input.value != null) {
        return safeToDate(input.value, fallback);
      }
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function safeToLocaleDateString(input, locale) {
  const d = safeToDate(input, null);
  if (!d) return "Invalid date";

  try {
    return d.toLocaleDateString(locale);
  } catch {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
  }
}

// Helper: top 5 newest by createdAt
function top5ByCreatedAtDesc(arr) {
  return (Array.isArray(arr) ? arr.slice() : [])
    .sort((a, b) => {
      const tb = safeToDate(b?.createdAt, new Date(0))?.getTime?.() ?? 0;
      const ta = safeToDate(a?.createdAt, new Date(0))?.getTime?.() ?? 0;
      return tb - ta;
    })
    .slice(0, 5);
}

const LS_LAST_VISITED_KEY = "announcements:lastVisitedAt";

export default function Announcements({ uid, locale }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastVisitedAt, setLastVisitedAt] = useState(null);

  // Toggle debug logs easily
  const DEBUG = true;

  const API_BASE =
    import.meta.env.VITE_API_URL ||
    "https://ugliest-hannie-ezaz-307892de.koyeb.app";

  // Load lastVisitedAt from localStorage & stamp this visit
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_LAST_VISITED_KEY);
      const parsed = stored ? new Date(stored) : null;
      setLastVisitedAt(parsed && !isNaN(parsed.getTime()) ? parsed : null);
    } catch {
      setLastVisitedAt(null);
    }

    // Stamp current visit time for next time
    try {
      localStorage.setItem(LS_LAST_VISITED_KEY, new Date().toISOString());
    } catch {
      // ignore storage failures
    }
  }, []);

  useEffect(() => {
    const source = axios.CancelToken.source();
    let isActive = true;

    (async () => {
      setLoading(true);

      try {
        let headers = {};
        if (uid) {
          try {
            const token = await auth.currentUser?.getIdToken();
            if (token) headers.Authorization = `Bearer ${token}`;
          } catch (e) {
            console.warn("Failed to get ID token (continuing without):", e);
          }
        }

        const getPromise = axios.get(`${API_BASE}/api/announcements`, {
          cancelToken: source.token,
          timeout: 12000,
        });

        const putPromise = uid
          ? axios.put(
              `${API_BASE}/api/users/${uid}/last-notified`,
              {},
              { headers, cancelToken: source.token, timeout: 12000 },
            )
          : Promise.resolve({ status: 204 });

        const [getRes, putRes] = await Promise.allSettled([
          getPromise,
          putPromise,
        ]);

        if (getRes.status === "fulfilled") {
          const arr = Array.isArray(getRes.value?.data)
            ? getRes.value.data
            : [];

          if (isActive) setAnnouncements(arr);
        } else if (!axios.isCancel(getRes.reason)) {
          console.error(
            "Failed to fetch announcements:",
            getRes.reason?.response ?? getRes.reason,
          );
          if (isActive) setAnnouncements([]);
        }

        if (putRes.status === "rejected" && !axios.isCancel(putRes.reason)) {
          console.error(
            "Failed to update lastNotified:",
            putRes.reason?.response ?? putRes.reason,
          );
        }
      } catch (e) {
        if (!axios.isCancel(e))
          console.error("Unexpected announcements flow error:", e);
        if (isActive) setAnnouncements([]);
      } finally {
        if (isActive) setLoading(false);
      }
    })();

    return () => {
      isActive = false;
      source.cancel("Announcements cleanup");
    };
  }, [uid, API_BASE]);

  const top5 = useMemo(
    () => top5ByCreatedAtDesc(announcements),
    [announcements],
  );

  if (loading) {
    return (
      <section className="max-w-xl mx-auto mt-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      </section>
    );
  }

  return (
    <section className="space-y-3 max-w-xl mx-auto mt-6">
      {top5.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No announcements yet.
        </p>
      )}

      {top5.map((a) => {
        // If you want to pause execution to inspect the object:
        // if (DEBUG && a?.createdAt) debugger;

        const created = safeToDate(a?.createdAt, null);

        const isNew =
          created && lastVisitedAt
            ? created.getTime() > lastVisitedAt.getTime()
            : false;

        return (
          <motion.div
            key={stableAnnouncementId(a)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 shadow-soft hover:shadow-md transition"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-base">{a.title}</h3>
                  {isNew && (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-medium border border-emerald-200 dark:border-emerald-800">
                      New
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {a.content}
                </p>
              </div>

              <span className="ml-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {a?.createdAt
                  ? safeToLocaleDateString(a.createdAt, locale)
                  : ""}
              </span>
            </div>
          </motion.div>
        );
      })}
    </section>
  );
}
