// Announcements.jsx
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import axios from "axios";

/* ---------- Stable key helpers ---------- */
function djb2(str = "") {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  return (h >>> 0).toString(36); // compact unsigned string
}

function stableAnnouncementId(a) {
  // Prefer backend ID
  if (a?._id) return String(a._id);
  if (a?.id) return String(a.id);
  // Deterministic content hash fallback
  const base = [
    a?.title ?? "",
    a?.content ?? "",
    // createdAt is usually immutable; if it’s not guaranteed, you can omit it
    a?.createdAt ? new Date(a.createdAt).toISOString() : "",
  ].join("||");
  return `ann-${djb2(base)}`;
}
/* --------------------------------------- */

export default function Announcements({ uid }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const API_BASE = "https://ugliest-hannie-ezaz-307892de.koyeb.app";

  useEffect(() => {
    const updateAndFetch = async () => {
      try {
        // Mark as read (lastNotified = now)
        if (uid) {
          await axios.put(`${API_BASE}/api/users/${uid}/last-notified`, {});
        }
      } catch (e) {
        console.error("Failed to update lastNotified:", e);
      } finally {
        try {
          const res = await axios.get(`${API_BASE}/api/announcements`);
          setAnnouncements(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
          console.error("Failed to fetch announcements:", err);
          setAnnouncements([]);
        } finally {
          setLoading(false);
        }
      }
    };

    updateAndFetch();
  }, [uid]);

  if (loading) {
    return (
      <section className="max-w-xl mx-auto mt-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      </section>
    );
  }

  return (
    <section className="space-y-3 max-w-xl mx-auto mt-6">
      {announcements.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No announcements yet.
        </p>
      )}

      {announcements.map((a) => (
        <motion.div
          key={stableAnnouncementId(a)} // ✅ stable key
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
            <span className="ml-3 text-xs text-gray-500 dark:text-gray-400">
              {a?.createdAt ? new Date(a.createdAt).toLocaleDateString() : ""}
            </span>
          </div>
        </motion.div>
      ))}
    </section>
  );
}
