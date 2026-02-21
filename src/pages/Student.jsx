import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";

import Skeleton from "../components/Skeleton.jsx";
import StudentWelcome from "../components/StudentWelcome.jsx";

// Demo fallback data
const demo = {
  student: { name: "Student", grade: "HSC", avatar: null },
  progress: 68,
  subjects: [
    { id: 1, name: "ICT — Chapter 1", progress: 90 },
    { id: 2, name: "ICT — Chapter 2", progress: 55 },
    { id: 3, name: "ICT — Chapter 3", progress: 42 },
  ],
  notices: [],
};

/** Safely convert a Firestore Timestamp / {seconds} / string / Date to a Date.
 *  Returns a valid Date; falls back to epoch (1970-01-01) if invalid.
 */
function safeToDate(input, fallback = new Date(0)) {
  try {
    if (!input) return fallback;

    // Firestore Timestamp object?
    if (typeof input === "object") {
      if (typeof input.toDate === "function") {
        const d = input.toDate();
        return isNaN(d?.getTime()) ? fallback : d;
      }
      // Serialized REST/axios form: {seconds, nanoseconds}
      if (typeof input.seconds === "number") {
        const d = new Date(input.seconds * 1000);
        return isNaN(d.getTime()) ? fallback : d;
      }
    }

    // String or Date
    const d = new Date(input);
    return isNaN(d.getTime()) ? fallback : d;
  } catch {
    return fallback;
  }
}

/** Format using locale date safely */
function safeToLocaleDateString(input) {
  return safeToDate(input, new Date()).toLocaleDateString();
}

export default function Student({ onOpenAuth, setRoute }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(demo);
  const [lastScore, setLastScore] = useState(0);
  const [latestNotes, setLatestNotes] = useState([]);
  const [latestAnnouncements, setLatestAnnouncements] = useState([]);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const baseUrl =
        import.meta.env.VITE_API_URL ||
        "https://ugliest-hannie-ezaz-307892de.koyeb.app";

      // Helper to safely set state only if mounted
      const safeSet =
        (setter) =>
        (...args) => {
          if (mountedRef.current) setter(...args);
        };
      const setLoadingSafe = safeSet(setLoading);
      const setLatestNotesSafe = safeSet(setLatestNotes);
      const setLatestAnnouncementsSafe = safeSet(setLatestAnnouncements);
      const setLastScoreSafe = safeSet(setLastScore);
      const setDataSafe = safeSet(setData);

      if (!user) {
        // Guest: just fetch public latest notes (no uid) + announcements
        try {
          setLoadingSafe(true);

          const [notesRes, annRes] = await Promise.all([
            // Server may not support &limit yet—client will slice
            fetch(`${baseUrl}/api/notes?limit=5`),
            fetch(`${baseUrl}/api/announcements`),
          ]);

          if (notesRes.ok) {
            const notes = await notesRes.json();
            const latest = Array.isArray(notes)
              ? notes
                  .slice() // prevent in-place sort
                  .sort(
                    (a, b) =>
                      safeToDate(b.createdAt).getTime() -
                      safeToDate(a.createdAt).getTime(),
                  )
                  .slice(0, 5)
              : [];
            setLatestNotesSafe(latest);
          } else {
            setLatestNotesSafe([]);
          }

          if (annRes.ok) {
            const anns = (await annRes.json()) || [];
            const latestAnns = anns
              .slice()
              .sort(
                (a, b) =>
                  safeToDate(b.createdAt).getTime() -
                  safeToDate(a.createdAt).getTime(),
              )
              .slice(0, 5);
            setLatestAnnouncementsSafe(latestAnns);
          } else {
            setLatestAnnouncementsSafe([]);
          }
        } catch (e) {
          console.error("Guest fetch failed:", e);
          setLatestNotesSafe([]);
          setLatestAnnouncementsSafe([]);
        } finally {
          setLoadingSafe(false);
        }
        return;
      }

      try {
        setLoadingSafe(true);

        // 1) Fetch backend user to get last_score and display name
        const res = await fetch(`${baseUrl}/api/users/${user.uid}`);
        if (res.ok) {
          const dbUser = await res.json();
          setLastScoreSafe(dbUser?.last_score || 0);
          setDataSafe((prev) => ({
            ...prev,
            student: {
              ...prev.student,
              name: dbUser?.displayName || user.displayName || "Student",
            },
          }));
        }

        // 2) Fetch latest notes
        const notesUrl = `${baseUrl}/api/notes?uid=${encodeURIComponent(
          user.uid,
        )}&limit=5`;
        const notesRes = await fetch(notesUrl);
        if (notesRes.ok) {
          const notes = await notesRes.json();
          const latest = Array.isArray(notes)
            ? notes
                .slice()
                .sort(
                  (a, b) =>
                    safeToDate(b.createdAt).getTime() -
                    safeToDate(a.createdAt).getTime(),
                )
                .slice(0, 5)
            : [];
          setLatestNotesSafe(latest);
        } else {
          setLatestNotesSafe([]);
        }

        // 3) Fetch latest announcements (top 5)
        const announcementsRes = await fetch(`${baseUrl}/api/announcements`);
        if (announcementsRes.ok) {
          const announcementsData = (await announcementsRes.json()) || [];
          const latestAnns = announcementsData
            .slice()
            .sort(
              (a, b) =>
                safeToDate(b.createdAt).getTime() -
                safeToDate(a.createdAt).getTime(),
            )
            .slice(0, 5);
          setLatestAnnouncementsSafe(latestAnns);
        } else {
          setLatestAnnouncementsSafe([]);
        }
      } catch (err) {
        console.error("Failed to fetch student data:", err);
        setLatestNotesSafe([]);
        setLatestAnnouncementsSafe([]);
      } finally {
        setLoadingSafe(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-28" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const { student, subjects } = data;

  return (
    <div className="space-y-4">
      {/* Hero */}
      <StudentWelcome student={student} onOpenAuth={onOpenAuth} />

      {/* Last Score Section */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-xl2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 shadow-soft"
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[var(--mm-teal)] text-white text-lg font-bold">
            {lastScore}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Last Exam Score</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Your most recent MCQ performance.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => setRoute("takeExam")}
                className="rounded-xl bg-[var(--mm-teal)] text-white py-2 text-sm font-medium shadow-soft hover:bg-[var(--mm-teal-dark)] active:translate-y-px transition"
              >
                Continue MCQs
              </button>
              <button
                onClick={() => setRoute("Notes")}
                className="rounded-xl border border-gray-200 dark:border-gray-800 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              >
                Read PDFs
              </button>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Latest Notes */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 shadow-soft"
      >
        <h3 className="font-semibold">Latest Notes</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {latestNotes.length > 0 ? (
            latestNotes.map((n) => (
              <li
                key={
                  n.id ||
                  n._id ||
                  `${n.originalName}-${n.storagePath || n.downloadURL || Math.random()}`
                }
                className="flex items-center justify-between"
              >
                <span className="truncate mr-3">
                  {n.noteName || n.originalName}
                </span>
                <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {safeToLocaleDateString(n.createdAt)}
                </span>
              </li>
            ))
          ) : (
            <li className="text-gray-500 dark:text-gray-400">
              No notes found.
            </li>
          )}
        </ul>
      </motion.section>

      {/* Latest Announcements */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="rounded-xl2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 shadow-soft"
      >
        <h3 className="font-semibold">Announcements</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {latestAnnouncements.length > 0 ? (
            latestAnnouncements.map((a) => (
              <li
                key={
                  a.id ||
                  a._id ||
                  `${a.title}-${safeToDate(a.createdAt).getTime()}`
                }
                className="flex items-center justify-between"
              >
                <span className="truncate mr-3">{a.title}</span>
                <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {safeToLocaleDateString(a.createdAt)}
                </span>
              </li>
            ))
          ) : (
            <li className="text-gray-500 dark:text-gray-400">
              No announcements.
            </li>
          )}
        </ul>
      </motion.section>
    </div>
  );
}
