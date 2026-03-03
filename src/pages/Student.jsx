// src/pages/Student.jsx
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

/** Helper: top 5 newest by createdAt (for announcements) */
function top5ByCreatedAtDesc(arr) {
  return (Array.isArray(arr) ? arr.slice() : [])
    .sort(
      (a, b) =>
        safeToDate(b?.createdAt).getTime() - safeToDate(a?.createdAt).getTime(),
    )
    .slice(0, 5);
}

/** Helper: top 5 by noteName A-Z (for notes) */
function top5ByNoteNameAsc(arr) {
  return (Array.isArray(arr) ? arr.slice() : [])
    .sort((a, b) => {
      const A = String(a?.noteName || a?.originalName || "").toLowerCase();
      const B = String(b?.noteName || b?.originalName || "").toLowerCase();
      return A.localeCompare(B);
    })
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

  // Profile details
  const [board, setBoard] = useState("");
  const [examYear, setExamYear] = useState("");

  const [downloading, setDownloading] = useState(false);

  // backend validation flag
  const [isValidated, setIsValidated] = useState(false);

  const mountedRef = useRef(true);

  const goToNotes = () => setRoute("Notes");

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
            setLatestNotesSafe(Array.isArray(notes) ? notes : []);
          } else {
            setLatestNotesSafe([]);
          }

          if (annRes.ok) {
            const anns = (await annRes.json()) || [];
            setLatestAnnouncementsSafe(Array.isArray(anns) ? anns : []);
          } else {
            setLatestAnnouncementsSafe([]);
          }

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

        // 1) backend user
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

        // 2) notes
        const notesUrl = `${baseUrl}/api/notes?uid=${encodeURIComponent(
          user.uid,
        )}&limit=5`;
        const notesRes = await fetch(notesUrl);
        if (notesRes.ok) {
          const notes = await notesRes.json();
          setLatestNotesSafe(Array.isArray(notes) ? notes : []);
        } else {
          setLatestNotesSafe([]);
        }

        // 3) announcements
        const announcementsRes = await fetch(`${baseUrl}/api/announcements`);
        if (announcementsRes.ok) {
          const announcementsData = (await announcementsRes.json()) || [];
          setLatestAnnouncementsSafe(
            Array.isArray(announcementsData) ? announcementsData : [],
          );
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

  // ✅ Notes: A–Z (noteName/originalName)
  const top5Notes = useMemo(
    () => top5ByNoteNameAsc(latestNotes),
    [latestNotes],
  );

  // ✅ Announcements: newest first
  const top5Announcements = useMemo(
    () => top5ByCreatedAtDesc(latestAnnouncements),
    [latestAnnouncements],
  );

  async function handleDownloadCertificate() {
    try {
      setDownloading(true);

      const studentName = (data?.student?.name || "Student").trim();
      const mark = Number(lastScore) || 0;
      const grade = getGrade(mark);

      const boardNameEn = (board || "").trim();
      const examYearStr = String(examYear || "").trim();
      const examTitle = "Higher Secondary Certificate (HSC)";
      const subjectTitle = "ICT MCQ Assessment";

      const rollNo = undefined;
      const regNo = undefined;
      const centerName = undefined;
      const sessionStr = examYearStr
        ? `${Number(examYearStr) - 1}-${examYearStr}`
        : undefined;

      const TEAL = [0, 121, 107];
      const GOLD = [191, 144, 0];
      const DARK = [34, 34, 34];
      const GREY = [95, 99, 104];
      const LIGHT = [242, 244, 247];
      const BORDER = [220, 223, 230];

      const doc = new jsPDF({ unit: "pt", format: "A4" });
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();

      doc.setDrawColor(...BORDER);
      doc.setLineWidth(1.2);
      doc.rect(24, 24, W - 48, H - 48);
      doc.setDrawColor(...BORDER);
      doc.rect(36, 36, W - 72, H - 72);

      const bandH = 88;
      const bandX = 36;
      const bandY = 36;
      const bandW = W - 72;
      doc.setFillColor(...LIGHT);
      doc.rect(bandX, bandY, bandW, bandH, "F");

      const logoX = 52;
      const logoY = 46;
      const logoSize = 64;
      try {
        const logo = await loadImage("/mastermind-logo.png");
        doc.addImage(logo, "PNG", logoX, logoY, logoSize, logoSize);
      } catch {
        doc.setDrawColor(...GOLD);
        doc.setLineWidth(2);
        doc.circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2.3);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...GOLD);
        doc.setFontSize(10);
        doc.text("LOGO", logoX + logoSize / 2, logoY + logoSize / 2 + 4, {
          align: "center",
        });
      }

      const headerLeft = logoX + logoSize + 20;
      const headerRightMargin = 24;
      const headerMaxWidth = W - headerLeft - headerRightMargin - 36;

      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.setFontSize(15);
      doc.text("Mastermind (Website)", headerLeft, 65);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GREY);
      doc.setFontSize(12);
      const subtitle =
        "This certificate is issued by the Mastermind website and is not affiliated with any Education Board.";
      const subtitleLines = doc.splitTextToSize(subtitle, headerMaxWidth);
      doc.text(subtitleLines, headerLeft, 85);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.setFontSize(22);
      doc.text("Provisional Result Certificate", W / 2, 165, {
        align: "center",
      });

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GREY);
      doc.setFontSize(11);
      doc.text(
        "This document certifies the following particulars and result, generated by Mastermind (website).",
        W / 2,
        184,
        { align: "center" },
      );

      const infoX = 52;
      const infoY = 210;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GREY);
      doc.setFontSize(11);
      const serialNo = "MM-HSC-" + String(Date.now()).slice(-8);
      doc.text(`Serial No.: ${serialNo}`, infoX, infoY);

      const stmtX = 52;
      const stmtY = 250;
      const stmtW = W - 104;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...DARK);
      doc.setFontSize(12);

      const boardPart = boardNameEn ? `, ${boardNameEn}` : "";
      const yearPart = examYearStr ? `, ${examYearStr}` : "";
      const statementEn = `This is to certify that ${studentName} has participated in the ${subjectTitle} under the ${examTitle}${boardPart}${yearPart}. The particulars and result are presented below.`;
      const linesEn = doc.splitTextToSize(statementEn, stmtW);
      doc.text(linesEn, stmtX, stmtY);

      const cardX = 52;
      const cardY = stmtY + 48;
      const cardW = W - 104;
      const cardH = 230;

      doc.setDrawColor(...BORDER);
      doc.setLineWidth(1);
      doc.roundedRect(cardX, cardY, cardW, cardH, 10, 10, "S");

      doc.setFillColor(...TEAL);
      doc.roundedRect(cardX, cardY, 200, 26, 10, 10, "F");
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.text("Candidate Details & Result", cardX + 12, cardY + 17);

      const leftX = cardX + 16;
      const rightX = cardX + cardW / 2 + 8;
      let y = cardY + 54;
      const rowGap = 42;

      const addField = (label, value, x, yPos) => {
        if (value === undefined || value === null) return yPos;
        const str = String(value).trim();
        if (!str) return yPos;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...GREY);
        doc.setFontSize(11);
        doc.text(label, x, yPos);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...DARK);
        doc.setFontSize(12);
        doc.text(str, x, yPos + 18);
        return yPos + rowGap;
      };

      y = addField("Candidate Name", studentName, leftX, y);
      y = addField("Roll No.", rollNo, leftX, y);
      y = addField("Registration No.", regNo, leftX, y);
      y = addField("Session", sessionStr, leftX, y);

      let ry = cardY + 54;
      ry = addField("Board", boardNameEn || undefined, rightX, ry);
      ry = addField("Exam Year", examYearStr || undefined, rightX, ry);
      ry = addField("Exam", examTitle, rightX, ry);
      ry = addField("Exam Centre", centerName, rightX, ry);

      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.8);
      doc.line(
        cardX + 12,
        cardY + cardH - 84,
        cardX + cardW - 12,
        cardY + cardH - 84,
      );

      const rY = cardY + cardH - 58;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.setFontSize(12);
      doc.text("Result (Grade):", cardX + 16, rY);

      const gradeText = grade;
      const badgePaddingX = 10;
      const textW = doc.getTextWidth(gradeText) + badgePaddingX * 2;
      const badgeX = cardX + 130;
      doc.setFillColor(...(gradeText === "Needs improvement" ? GOLD : TEAL));
      doc.roundedRect(badgeX, rY - 14, textW, 22, 6, 6, "F");
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.text(gradeText, badgeX + badgePaddingX, rY + 2);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.setFontSize(12);
      doc.text("Score (%):", rightX, rY);
      doc.text(String(mark), rightX + 80, rY);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GREY);
      doc.setFontSize(10);
      doc.text(
        `Issued on ${new Date().toLocaleDateString()}`,
        cardX + 16,
        cardY + cardH - 16,
      );

      const sigY = cardY + cardH + 72;
      const sigBoxW = 180;
      const leftSigX = 52;
      const rightSigX = W - 52 - sigBoxW;

      const signatureBlock = (x, title1, title2) => {
        doc.setDrawColor(...BORDER);
        doc.setLineWidth(1);
        doc.line(x, sigY, x + sigBoxW, sigY);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...GREY);
        doc.setFontSize(10);
        doc.text(title1, x, sigY + 16);
        doc.text(title2, x, sigY + 30);
      };

      signatureBlock(leftSigX, "Head of Institution", "(Signature & Seal)");
      signatureBlock(
        rightSigX,
        "Controller (Website Operations)",
        "(Authorized Signature)",
      );

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GREY);
      doc.setFontSize(9);
      doc.text(
        "Disclaimer: This certificate is generated by the Mastermind website for academic/reference purposes only and is NOT an official Education Board document.",
        W / 2,
        H - 40,
        { align: "center" },
      );

      const filename = `hsc-certificate-${(studentName || "student")
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
            onClick={goToNotes}
            className="rounded-xl bg-[var(--mm-teal)] text-white py-2 text-sm font-medium shadow-soft hover:bg-[var(--mm-teal-dark)] active:translate-y-px transition"
          >
            Read PDFs
          </button>
          <button
            onClick={() => setRoute("takeExam")}
            className="rounded-xl bg-[var(--mm-teal)] text-white py-2 text-sm font-medium shadow-soft hover:bg-[var(--mm-teal-dark)] active:translate-y-px transition"
          >
            Continue MCQs
          </button>
        </div>
      </motion.section>

      {/* Last Exam Score + Grade + Download Certificate Button */}
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

              <div className="mt-3 flex flex-wrap items-center gap-2">
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
        onClick={goToNotes}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") goToNotes();
        }}
        className="rounded-xl2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 shadow-soft cursor-pointer"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Available Chapters</h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Tap to open Notes →
          </span>
        </div>

        <ul className="mt-3 space-y-2 text-sm">
          {top5Notes.length > 0 ? (
            top5Notes.map((n) => {
              const isFree = Boolean(n?.isPublic);

              return (
                <li
                  key={
                    n.id ||
                    n._id ||
                    `${n.originalName}-${n.storagePath || n.downloadURL || "x"}`
                  }
                  className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 dark:border-gray-800 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/40"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToNotes();
                  }}
                >
                  <span className="truncate">
                    {n.noteName || n.originalName}
                  </span>

                  <span
                    className={[
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                      isFree
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
                    ].join(" ")}
                    title={
                      isFree
                        ? "This chapter is free"
                        : "This chapter is premium"
                    }
                  >
                    {isFree ? "Free" : "Premium"}
                  </span>
                </li>
              );
            })
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

      {/* Branding Card */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        whileHover={{ y: -4 }}
        className="rounded-xl2 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-soft hover:shadow-xl transition-all duration-300 overflow-hidden"
      >
        {/* Banner */}
        <div className="w-full px-6 pt-8 pb-4">
          <div className="flex justify-center">
            <img
              src="/ictbanner.jpg"
              alt="ICT Mastermind Banner"
              className="max-h-28 sm:max-h-36 object-contain"
              loading="lazy"
            />
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-center space-y-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">
              ICT Mastermind
            </h1>

            <p className="text-lg font-semibold text-[var(--mm-teal)]">
              {auth.currentUser
                ? "Continue Your HSC ICT Journey!"
                : "Unlock Your HSC ICT Potential!"}
            </p>

            <p className="text-sm sm:text-base font-semibold text-gray-600 dark:text-gray-400">
              HSC ICT Learning & Exam Preparation Platform
            </p>

            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
              HSC ICT Preparation, Smart Tips & Exam Hacks – সব এক জায়গায়!
              <br />
              Board Exam Ready হতে আজই শুরু করো।
            </p>

            {!auth.currentUser && (
              <button
                onClick={onOpenAuth}
                className="mt-3 rounded-xl bg-[var(--mm-teal)] px-6 py-2 text-sm font-semibold text-white shadow-md hover:bg-[var(--mm-teal-dark)] hover:shadow-lg transition"
              >
                📚 Join Now & Master HSC ICT Like a Pro!
              </button>
            )}
          </div>

          {/* Bottom Section */}
          <div className="mt-10 flex flex-col items-center gap-6">
            {/* Icons */}
            <div className="flex items-center justify-center gap-6">
              {/* Facebook */}
              <a
                href="https://facebook.com/ictmastermindbd"
                target="_blank"
                rel="noreferrer"
                className="group inline-flex h-11 w-11 items-center justify-center rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 transition-all duration-300 hover:border-[var(--mm-teal)] hover:shadow-[0_0_18px_rgba(0,150,136,0.4)] hover:scale-110"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 group-hover:text-[var(--mm-teal)] transition-colors"
                  fill="currentColor"
                >
                  <path d="M22 12.07C22 6.49 17.52 2 11.93 2 6.35 2 1.86 6.49 1.86 12.07c0 5.04 3.65 9.22 8.44 10.02v-7.1H7.74v-2.92h2.56V9.85c0-2.53 1.5-3.93 3.8-3.93 1.1 0 2.25.2 2.25.2v2.48h-1.27c-1.25 0-1.64.78-1.64 1.57v1.88h2.8l-.45 2.92h-2.35v7.1c4.79-.8 8.44-4.98 8.44-10.02Z" />
                </svg>
              </a>

              {/* Website */}
              <a
                href="https://ictmastermind.com"
                target="_blank"
                rel="noreferrer"
                className="group inline-flex h-11 w-11 items-center justify-center rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 transition-all duration-300 hover:border-[var(--mm-teal)] hover:shadow-[0_0_18px_rgba(0,150,136,0.4)] hover:scale-110"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 group-hover:text-[var(--mm-teal)] transition-colors"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20" />
                  <path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10Z" />
                </svg>
              </a>
            </div>

            {/* Full Width Dark Divider */}
            <div className="w-full h-[2px] bg-black dark:bg-gray-700"></div>

            {/* Copyright */}
            <span className="text-xs text-gray-600 dark:text-gray-400 text-center">
              © 2026 ICT Mastermind. All Rights Reserved
            </span>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
