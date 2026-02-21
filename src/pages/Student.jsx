import { useEffect, useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { onAuthStateChanged } from "firebase/auth";
import jsPDF from "jspdf";
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

/** Format using locale date safely */
function safeToLocaleDateString(input) {
  return safeToDate(input, new Date()).toLocaleDateString();
}

/** Helper: get top 5 items by createdAt desc in a robust way */
function top5ByCreatedAtDesc(arr) {
  return (Array.isArray(arr) ? arr.slice() : [])
    .sort(
      (a, b) =>
        safeToDate(b?.createdAt).getTime() - safeToDate(a?.createdAt).getTime(),
    )
    .slice(0, 5);
}

/** Grade helper (your rules) */
function getGrade(score) {
  if (typeof score !== "number") return "";
  if (score >= 80) return "A+";
  if (score >= 70) return "A";
  if (score <= 60) return "Needs improvement";
  return "Keep going"; // 61–69
}

/** Small helper to load the public logo for jsPDF */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export default function Student({ onOpenAuth, setRoute }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(demo);
  const [lastScore, setLastScore] = useState(0);
  const [latestNotes, setLatestNotes] = useState([]);
  const [latestAnnouncements, setLatestAnnouncements] = useState([]);

  // Profile details we’ll fetch similar to StudentWelcome.jsx
  const [board, setBoard] = useState(""); // e.g., "Dhaka"
  const [examYear, setExamYear] = useState(""); // e.g., "2026"

  const [downloading, setDownloading] = useState(false);

  // NEW: backend validation flag
  const [isValidated, setIsValidated] = useState(false);

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

      // Safe setState wrapper
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
      const setBoardSafe = safeSet(setBoard);
      const setExamYearSafe = safeSet(setExamYear);
      const setIsValidatedSafe = safeSet(setIsValidated);

      if (!user) {
        // Guest: public latest notes + announcements only
        try {
          setLoadingSafe(true);

          const [notesRes, annRes] = await Promise.all([
            fetch(`${baseUrl}/api/notes?limit=5`),
            fetch(`${baseUrl}/api/announcements`),
          ]);

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

          // Guest defaults (no validation, hide score card)
          setBoardSafe("—");
          setExamYearSafe("—");
          setIsValidatedSafe(false);
          setLastScoreSafe(0);
        } catch (e) {
          console.error("Guest fetch failed:", e);
          setLatestNotesSafe([]);
          setLatestAnnouncementsSafe([]);
          setBoardSafe("—");
          setExamYearSafe("—");
          setIsValidatedSafe(false);
          setLastScoreSafe(0);
        } finally {
          setLoadingSafe(false);
        }
        return;
      }

      try {
        setLoadingSafe(true);

        // 1) Fetch backend user → last_score, displayName, Board, ExamYEar, is_validated
        const res = await fetch(`${baseUrl}/api/users/${user.uid}`);
        if (res.ok) {
          const dbUser = await res.json();

          setLastScoreSafe(dbUser?.last_score ?? 0);
          setBoardSafe(
            typeof dbUser?.Board === "string" && dbUser.Board.trim()
              ? dbUser.Board.trim()
              : "—",
          );
          setExamYearSafe(dbUser?.ExamYEar ? String(dbUser?.ExamYEar) : "—");

          // NEW: set validation flag
          setIsValidatedSafe(Boolean(dbUser?.is_validated));

          setDataSafe((prev) => ({
            ...prev,
            student: {
              ...prev.student,
              name: dbUser?.displayName || user.displayName || "Student",
            },
          }));
        } else {
          setBoardSafe("—");
          setExamYearSafe("—");
          setIsValidatedSafe(false);
        }

        // 2) Latest notes
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

        // 3) Announcements
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
        setBoardSafe("—");
        setExamYearSafe("—");
        setIsValidatedSafe(false);
      } finally {
        setLoadingSafe(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // UI-level guarantee: top 5 newest first
  const top5Notes = useMemo(
    () => top5ByCreatedAtDesc(latestNotes),
    [latestNotes],
  );
  const top5Announcements = useMemo(
    () => top5ByCreatedAtDesc(latestAnnouncements),
    [latestAnnouncements],
  );

  // ==== PDF: Professional, minimal certificate (no signatures/unnecessary fields) ====
  async function handleDownloadCertificate() {
    try {
      setDownloading(true);

      const studentName = data?.student?.name || "Student";
      const mark = Number(lastScore) || 0;
      const grade = getGrade(mark);

      // Palette (Teal & Orange) — aligns with your brand
      const TEAL = [15, 139, 141]; // #0F8B8D
      const ORANGE = [246, 170, 28]; // #F6AA1C
      const DARK = [28, 28, 30];
      const GREY = [90, 96, 106];
      const LIGHT_BORDER = [230, 233, 238];

      const doc = new jsPDF({ unit: "pt", format: "A4" });
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();

      // Header (brand band)
      doc.setFillColor(...TEAL);
      doc.rect(0, 0, W, 84, "F");

      // Try logo from /public
      try {
        const img = await loadImage("/mastermind-logo.png");
        const logoW = 68;
        const logoH = 68;
        doc.addImage(img, "PNG", 40, 8, logoW, logoH);
      } catch {
        // Minimal fallback
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.text("MASTERMIND", 40, 58);
      }

      // Title
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.setFontSize(26);
      doc.text("Certificate of Achievement", W / 2, 150, { align: "center" });

      // Subline
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GREY);
      doc.setFontSize(12);
      doc.text("Presented to", W / 2, 176, { align: "center" });

      // Recipient
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.setFontSize(30);
      doc.text(studentName, W / 2, 210, { align: "center" });

      // Short description
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GREY);
      doc.setFontSize(12);
      const examName = "ICT MCQ Assessment";
      doc.text(
        `For successful participation and performance in the ${examName}.`,
        W / 2,
        238,
        { align: "center" },
      );

      // Content card outline
      const cardX = W * 0.12;
      const cardW = W * 0.76;
      const cardY = 265;
      const cardH = 250;

      doc.setDrawColor(...LIGHT_BORDER);
      doc.setLineWidth(1);
      doc.roundedRect(cardX, cardY, cardW, cardH, 10, 10, "S");

      // Section heading
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.setFontSize(14);
      doc.text("Exam Details", cardX + 18, cardY + 30);

      // Divider under heading
      doc.setDrawColor(...TEAL);
      doc.setLineWidth(1);
      doc.line(cardX + 18, cardY + 40, cardX + cardW - 18, cardY + 40);

      // Details grid (2 columns)
      const leftX = cardX + 18;
      const rightX = cardX + cardW / 2 + 6;
      let rowY = cardY + 70;
      const rowGap = 34;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GREY);
      doc.setFontSize(11);

      // Left column
      doc.text("Board", leftX, rowY);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.setFontSize(12);
      doc.text(String(board || "—"), leftX, rowY + 18);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GREY);
      doc.setFontSize(11);
      rowY += rowGap;
      doc.text("Exam Year", leftX, rowY);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.setFontSize(12);
      doc.text(String(examYear || "—"), leftX, rowY + 18);

      // Right column
      let rY = cardY + 70;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GREY);
      doc.setFontSize(11);
      doc.text("Score (%)", rightX, rY);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.setFontSize(12);
      doc.text(String(Number(lastScore) || 0), rightX, rY + 18);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GREY);
      doc.setFontSize(11);
      rY += rowGap;
      doc.text("Grade", rightX, rY);
      // Grade badge (solid fill, compact)
      const gradeText = grade;
      const badgePaddingX = 10;
      const badgeY = rY + 6;
      const textW = doc.getTextWidth(gradeText) + badgePaddingX * 2;
      const badgeX = rightX - 2;
      doc.setFillColor(...(gradeText === "Needs improvement" ? ORANGE : TEAL));
      doc.roundedRect(badgeX, badgeY, textW, 22, 6, 6, "F");
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.text(gradeText, badgeX + badgePaddingX, badgeY + 15);

      // Bottom row: Issue date + Exam
      const bottomY = cardY + cardH - 24;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GREY);
      doc.setFontSize(10);
      doc.text(`Issued on ${new Date().toLocaleDateString()}`, leftX, bottomY);
      doc.text(examName, rightX, bottomY);

      // Footer subtle brand line
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GREY);
      doc.setFontSize(9);
      doc.text(
        "Mastermind • Learning that elevates performance",
        W / 2,
        H - 40,
        { align: "center" },
      );

      const filename = `certificate-${(studentName || "student")
        .toLowerCase()
        .replace(/\s+/g, "-")}.pdf`;
      doc.save(filename);
    } catch (e) {
      console.error("Certificate generation failed:", e);
      alert("Could not generate the certificate. See console for details.");
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-28" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const { student } = data;

  return (
    <div className="space-y-4">
      {/* Hero */}
      <StudentWelcome student={student} onOpenAuth={onOpenAuth} />

      {/* Quick Actions */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-xl2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 shadow-soft"
      >
        <h3 className="font-semibold">Quick Actions</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Jump right back in.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => setRoute("takeExam")}
            className="rounded-xl bg-[var(--mm-teal)] text-white py-2 text-sm font-medium shadow-soft hover:bg-[var(--mm-teal-dark)] active:translate-y-px transition"
          >
            Continue MCQs
          </button>
          {/* Made teal to match your theme */}
          <button
            onClick={() => setRoute("Notes")}
            className="rounded-xl bg-[var(--mm-teal)] text-white py-2 text-sm font-medium shadow-soft hover:bg-[var(--mm-teal-dark)] active:translate-y-px transition"
          >
            Read PDFs
          </button>
        </div>
      </motion.section>

      {/* Last Exam Score + Grade + Download Certificate Button */}
      {/* ONLY show if backend says the user is validated */}
      {isValidated && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 shadow-soft"
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[var(--mm-teal)] text-white text-lg font-bold">
              {lastScore}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">Last Exam Score</h3>
                {(() => {
                  const grade = getGrade(lastScore);
                  const isWarning = grade === "Needs improvement";
                  return (
                    <span
                      className={[
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                        isWarning
                          ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"
                          : "bg-[var(--mm-teal)]/10 text-[var(--mm-teal)] dark:text-teal-300",
                      ].join(" ")}
                    >
                      {grade}
                    </span>
                  );
                })()}
              </div>

              <p className="text-sm text-gray-500 dark:text-gray-400">
                Your most recent MCQ performance.
              </p>

              {/* Download button INSIDE the mark card */}
              <div className="mt-3 flex flex-wrap gap-2">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Board:{" "}
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    {board || "—"}
                  </span>
                  {" • "}
                  Year:{" "}
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    {examYear || "—"}
                  </span>
                </div>
                <button
                  onClick={handleDownloadCertificate}
                  disabled={downloading}
                  className="rounded-xl bg-[var(--mm-teal)] text-white px-4 py-2 text-sm font-medium shadow-soft hover:bg-[var(--mm-teal-dark)] active:translate-y-px transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {downloading ? "Generating…" : "Download Certificate (PDF)"}
                </button>
              </div>
            </div>
          </div>
        </motion.section>
      )}

      {/* Latest Notes */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 shadow-soft"
      >
        <h3 className="font-semibold">Available Chapters</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {top5Notes.length > 0 ? (
            top5Notes.map((n) => (
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
          {top5Announcements.length > 0 ? (
            top5Announcements.map((a) => (
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
