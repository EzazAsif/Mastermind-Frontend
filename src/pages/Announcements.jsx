// Announcements.jsx
import { useEffect, useRef, useState, useMemo } from "react";
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
    a?.createdAt ? new Date(a.createdAt).toISOString() : "",
  ].join("||");
  return `ann-${djb2(base)}`;
}
/* --------------------------------------- */

/** Safe date converter for Firestore Timestamp / {seconds} / string / Date */
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

// Helper: top 5 newest by createdAt
function top5ByCreatedAtDesc(arr) {
  return (Array.isArray(arr) ? arr.slice() : [])
    .sort(
      (a, b) =>
        safeToDate(b?.createdAt).getTime() - safeToDate(a?.createdAt).getTime(),
    )
    .slice(0, 5);
}

export default function Announcements({ uid, locale }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  const API_BASE =
    import.meta.env.VITE_API_URL ||
    "https://ugliest-hannie-ezaz-307892de.koyeb.app";

  useEffect(() => {
    const source = axios.CancelToken.source();
    let isActive = true;

    (async () => {
      setLoading(true);

      try {
        // Prepare token header if uid present (for PUT)
        let headers = {};
        if (uid) {
          try {
            const token = await auth.currentUser?.getIdToken();
            if (token) headers.Authorization = `Bearer ${token}`;
          } catch (e) {
            console.warn("Failed to get ID token (continuing without):", e);
          }
        }

        // Fire GET immediately; run PUT in parallel (don't block UI)
        const getPromise = axios.get(`${API_BASE}/api/announcements`, {
          cancelToken: source.token,
          timeout: 12000,
        });

        const putPromise = uid
          ? axios.put(
              `${API_BASE}/api/users/${uid}/last-notified`,
              {},
              {
                headers,
                cancelToken: source.token,
                timeout: 12000,
              },
            )
          : Promise.resolve({ status: 204 });

        const [getRes, putRes] = await Promise.allSettled([
          getPromise,
          putPromise,
        ]);

        // Handle GET
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

        // Log PUT failure but don't block UI
        if (putRes.status === "rejected" && !axios.isCancel(putRes.reason)) {
          console.error(
            "Failed to update lastNotified:",
            putRes.reason?.response ?? putRes.reason,
          );
        }
      } catch (e) {
        if (!axios.isCancel(e)) {
          console.error("Unexpected announcements flow error:", e);
        }
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

      {top5.map((a) => (
        <motion.div
          key={stableAnnouncementId(a)}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="w-full rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 shadow-soft hover:shadow-md transition"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-base">{a.title}</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {a.content}
              </p>
            </div>
            <span className="ml-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {a?.createdAt ? safeToLocaleDateString(a.createdAt, locale) : ""}
            </span>
          </div>
        </motion.div>
      ))}
    </section>
  );
}
