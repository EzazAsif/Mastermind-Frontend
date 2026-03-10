// TakeExam.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { auth } from "../lib/firebase";
import ValidationModal from "../components/ValidationModal.jsx";
import AuthModal from "../components/AuthModal.jsx";

/* ===========================================
   Stable Key Helpers (no randomness)
=========================================== */
const banglaOptions = ["ক", "খ", "গ", "ঘ"];

function hashString(s) {
  let h1 = 0xdeadbeef,
    h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = (h1 ^ (h1 >>> 16)) >>> 0;
  h2 = (h2 ^ (h2 >>> 16)) >>> 0;
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

function stableIdFromQuestion(q) {
  if (q?._id != null) return String(q._id);
  if (q?.id != null) return String(q.id);

  if (q?.setId != null) {
    const order = Number.isFinite(q?.setOrder) ? q.setOrder : 0;
    return `set:${q.setId}#${order}`;
  }

  const payload = JSON.stringify({
    text: q?.text ?? "",
    options: q?.options ?? [],
    image: q?.image ?? "",
    correctAnswer: q?.correctAnswer ?? null,
    src: q?.src ?? "",
    examId: q?.examId ?? q?.exam ?? "",
  });

  return `hash:${hashString(payload)}`;
}

/* ===========================================
   Question selection
   Rule:
   1. Keep total only 25
   2. Set questions first
   3. Then other questions fill remaining slots
=========================================== */
function pickExamQuestions(rawQuestions, totalNeeded = 25) {
  const normalized = (rawQuestions || []).map((q, index) => ({
    ...q,
    __stableId: stableIdFromQuestion(q),
    __originalIndex: index,
  }));

  // remove duplicate questions first
  const uniqueMap = new Map();
  for (const q of normalized) {
    if (!uniqueMap.has(q.__stableId)) {
      uniqueMap.set(q.__stableId, q);
    }
  }
  const uniqueQuestions = Array.from(uniqueMap.values());

  const setQuestions = uniqueQuestions
    .filter((q) => q?.setId != null)
    .sort((a, b) => {
      const setCmp = String(a.setId).localeCompare(String(b.setId));
      if (setCmp !== 0) return setCmp;

      const aOrder = Number.isFinite(a?.setOrder) ? a.setOrder : 999999;
      const bOrder = Number.isFinite(b?.setOrder) ? b.setOrder : 999999;
      if (aOrder !== bOrder) return aOrder - bOrder;

      return a.__originalIndex - b.__originalIndex;
    });

  const otherQuestions = uniqueQuestions
    .filter((q) => q?.setId == null)
    .sort((a, b) => a.__originalIndex - b.__originalIndex);

  const picked = [...setQuestions];

  if (picked.length < totalNeeded) {
    picked.push(...otherQuestions.slice(0, totalNeeded - picked.length));
  }

  return picked
    .slice(0, totalNeeded)
    .map(({ __stableId, __originalIndex, ...q }) => ({
      ...q,
      _id: __stableId,
    }));
}

/** exam_taken formats supported:
 *  - {"taken": true}
 *  - true
 *  - "true"
 */
function readExamTaken(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    if (raw === "true") return true;
    const v = JSON.parse(raw);
    return v === true || v?.taken === true;
  } catch {
    return false;
  }
}

function writeExamTaken(key) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ taken: true, takenAt: new Date().toISOString() }),
    );
    return true;
  } catch {
    return false;
  }
}

// serverUser.is_validated can be true/false, 1/0, "true"/"false"
function isUserValidated(serverUser) {
  const raw = serverUser?.is_validated;
  return raw === true || raw === 1 || raw === "true";
}

/* ===========================================
   Beautiful Modals
=========================================== */
function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  actions,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        aria-label="Close modal"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-gray-950 border border-gray-200/70 dark:border-gray-800 shadow-2xl overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-teal-500 to-orange-500" />
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="shrink-0 h-11 w-11 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 flex items-center justify-center">
              <span className="text-xl">{icon}</span>
            </div>

            <div className="min-w-0">
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-gray-50">
                {title}
              </h3>
              {subtitle && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="mt-5">{children}</div>

          <div className="mt-6 flex justify-end gap-2">{actions}</div>
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, value, tone = "info" }) {
  const toneCls =
    tone === "good"
      ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900 text-green-700 dark:text-green-300"
      : tone === "bad"
        ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300"
        : tone === "muted"
          ? "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200"
          : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-200";

  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border ${toneCls}`}
    >
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-sm font-extrabold">{value}</span>
    </div>
  );
}

function IntroModal({ open, totalQuestions, minutes, onOk }) {
  return (
    <ModalShell
      open={open}
      onClose={onOk}
      title="Ready to start?"
      subtitle={`There will be ${totalQuestions} questions and ${minutes} minutes to take the exam. Good luck!`}
      icon="✏️"
      actions={
        <button
          type="button"
          onClick={onOk}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm"
        >
          Start Exam
        </button>
      }
    >
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-4">
        <p className="text-gray-700 dark:text-gray-200 leading-relaxed">
          Tip: Don’t refresh the page during the exam.
        </p>
      </div>
    </ModalShell>
  );
}

function ResultModal({
  open,
  correct,
  wrong,
  unanswered,
  total,
  percentage,
  onClose,
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Exam summary"
      subtitle="Close this to see the full review with correct answers highlighted."
      icon="✅"
      actions={
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm"
        >
          Close & review
        </button>
      }
    >
      <div className="space-y-3">
        <StatPill label="Score" value={`${correct} / ${total}`} tone="info" />
        <StatPill label="Percentage" value={`${percentage}%`} tone="info" />

        <div className="grid grid-cols-3 gap-3 pt-1">
          <div className="rounded-2xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 p-3">
            <div className="text-xs font-semibold text-green-700 dark:text-green-300">
              Correct
            </div>
            <div className="mt-1 text-lg font-extrabold text-green-800 dark:text-green-200">
              {correct}
            </div>
          </div>

          <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3">
            <div className="text-xs font-semibold text-red-700 dark:text-red-300">
              Wrong
            </div>
            <div className="mt-1 text-lg font-extrabold text-red-800 dark:text-red-200">
              {wrong}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-3">
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">
              Unanswered
            </div>
            <div className="mt-1 text-lg font-extrabold text-gray-900 dark:text-gray-50">
              {unanswered}
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

/* ===========================================
   Option row
=========================================== */
function OptionRow({
  label,
  letter,
  isSelected,
  isCorrectOption,
  isWrongSelected,
  disabled,
  onSelect,
  showReviewColors,
}) {
  const base =
    "mt-1 h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0";

  let ring = "ring-1 ring-gray-300 dark:ring-gray-700";
  let bg = "bg-white dark:bg-gray-950";
  let text = "text-gray-800 dark:text-gray-100";
  let dotCls = "h-2.5 w-2.5 rounded-full bg-transparent";

  const hideLetter = isSelected;

  if (showReviewColors) {
    if (isCorrectOption) {
      ring = "ring-2 ring-green-500";
      bg = "bg-green-100 dark:bg-green-950/30";
      text = "text-green-700 dark:text-green-300";
      dotCls = "h-2.5 w-2.5 rounded-full bg-green-500";
    } else if (isWrongSelected) {
      ring = "ring-2 ring-red-500";
      bg = "bg-red-100 dark:bg-red-950/30";
      text = "text-red-700 dark:text-red-300";
      dotCls = "h-2.5 w-2.5 rounded-full bg-red-500";
    } else if (isSelected) {
      ring = "ring-2 ring-black";
      bg = "bg-white dark:bg-gray-950";
      dotCls = "h-2.5 w-2.5 rounded-full bg-black";
    }
  } else {
    if (isSelected) {
      ring = "ring-2 ring-black";
      bg = "bg-white dark:bg-gray-950";
      dotCls = "h-2.5 w-2.5 rounded-full bg-black";
    } else {
      dotCls = "h-2.5 w-2.5 rounded-full bg-transparent";
    }
  }

  const showDot = showReviewColors
    ? isCorrectOption || isWrongSelected || isSelected
    : isSelected;

  return (
    <label
      className={`relative flex items-start gap-3 p-2 rounded-xl ${
        disabled
          ? "cursor-not-allowed opacity-95"
          : "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900"
      }`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        if (!disabled) onSelect();
      }}
    >
      <span className={`${base} ${ring} ${bg}`} aria-hidden="true">
        {hideLetter ? showDot ? <span className={dotCls} /> : null : letter}
      </span>

      <input
        type="radio"
        className="absolute opacity-0 pointer-events-none"
        disabled={disabled}
        checked={isSelected}
        readOnly
        tabIndex={-1}
      />

      <span className={`leading-6 ${text}`}>{label}</span>
    </label>
  );
}

export default function TakeExam() {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(900);

  const [examStarted, setExamStarted] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);

  const [submitted, setSubmitted] = useState(false);

  const [correctCount, setCorrectCount] = useState(null);
  const [percentage, setPercentage] = useState(null);

  const [resultOpen, setResultOpen] = useState(false);
  const [summary, setSummary] = useState({
    correct: 0,
    wrong: 0,
    unanswered: 0,
    total: 0,
  });

  const [reviewMode, setReviewMode] = useState(false);

  const [authReady, setAuthReady] = useState(false);
  const [uid, setUid] = useState(null);

  const [serverUser, setServerUser] = useState(null);
  const [userLoading, setUserLoading] = useState(false);

  const [loginOpen, setLoginOpen] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);

  const timerRef = useRef();

  const API_ORIGIN = "https://ugliest-hannie-ezaz-307892de.koyeb.app";
  const EXAM_TAKEN_KEY = "exam_taken";
  const TOTAL_QUESTIONS = 25;

  useEffect(() => {
    const prev = document.body.style.overflow;
    if (prev === "hidden") document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setUid(u?.uid || null);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  const fetchServerUser = async (uidToFetch) => {
    const res = await fetch(`${API_ORIGIN}/api/users/${uidToFetch}`);
    if (!res.ok) throw new Error("Failed to fetch user");
    return await res.json();
  };

  useEffect(() => {
    if (!authReady) return;

    if (!uid) {
      setServerUser(null);
      setUserLoading(false);
      return;
    }

    let cancelled = false;
    setUserLoading(true);

    (async () => {
      try {
        const data = await fetchServerUser(uid);
        if (!cancelled) setServerUser(data);
      } catch {
        if (!cancelled) setServerUser(null);
      } finally {
        if (!cancelled) setUserLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, uid]);

  const examTaken = useMemo(() => readExamTaken(EXAM_TAKEN_KEY), [submitted]);

  const validatedReady = useMemo(() => {
    if (!uid) return true;
    return !userLoading;
  }, [uid, userLoading]);

  const validated = useMemo(() => {
    if (!uid) return false;
    if (!validatedReady) return false;
    return isUserValidated(serverUser);
  }, [uid, validatedReady, serverUser]);

  const canTakeExam = validated || !examTaken || submitted;
  const shouldBlock = examTaken && !validated && !submitted && validatedReady;

  useEffect(() => {
    if (!shouldBlock) {
      setShowValidationModal(false);
      setLoginOpen(false);
      return;
    }

    if (!uid) {
      setLoginOpen(true);
      setShowValidationModal(false);
      return;
    }

    if (!validatedReady) return;

    setShowValidationModal(true);
    setLoginOpen(false);
  }, [shouldBlock, uid, validatedReady]);

  useEffect(() => {
    let cancelled = false;

    async function fetchQuestions() {
      if (!canTakeExam) return;

      try {
        const assembled = await axios.get(`${API_ORIGIN}/exams/assembled`, {
          params: {
            base: TOTAL_QUESTIONS,
            max: 100,
            absoluteImages: true,
          },
        });

        const rawList = assembled.data?.questions || [];
        const finalList = pickExamQuestions(rawList, TOTAL_QUESTIONS);

        if (!cancelled) {
          setQuestions(finalList);

          setAnswers({});
          setSubmitted(false);
          setCorrectCount(null);
          setPercentage(null);
          setSummary({ correct: 0, wrong: 0, unanswered: 0, total: 0 });
          setResultOpen(false);
          setReviewMode(false);
          setExamStarted(false);
          setIntroOpen(false);
          setTimeLeft(900);
        }
      } catch {
        if (!cancelled) alert("Failed to load exam");
      }
    }

    fetchQuestions();
    return () => {
      cancelled = true;
    };
  }, [API_ORIGIN, canTakeExam]);

  useEffect(() => {
    if (!questions.length) return;
    if (submitted) return;
    if (!canTakeExam) return;

    if (!examStarted) setIntroOpen(true);
  }, [questions.length, submitted, canTakeExam, examStarted]);

  useEffect(() => {
    if (!questions.length || submitted) return;
    if (!canTakeExam) return;
    if (!examStarted) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, submitted, canTakeExam, examStarted]);

  const handleChange = (qId, optIndex) => {
    if (!examStarted) return;
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qId]: Number(optIndex) }));
  };

  const computeSummary = () => {
    let correct = 0;
    let wrong = 0;
    let unanswered = 0;

    questions.forEach((q) => {
      const ans = answers[q._id];
      if (ans === undefined) {
        unanswered++;
        return;
      }
      if (ans === q.correctAnswer) correct++;
      else wrong++;
    });

    return {
      correct,
      wrong,
      unanswered,
      total: questions.length,
    };
  };

  const handleSubmit = async () => {
    if (submitted) return;

    clearInterval(timerRef.current);

    writeExamTaken(EXAM_TAKEN_KEY);

    const s = computeSummary();
    const pct = Number(((s.correct / s.total) * 100).toFixed(2));

    setCorrectCount(s.correct);
    setPercentage(pct);
    setSummary(s);
    setSubmitted(true);
    setResultOpen(true);

    if (!uid) return;

    try {
      await axios.put(`${API_ORIGIN}/api/users/${uid}/score`, {
        score: pct,
      });
    } catch {}
  };

  if (!canTakeExam) {
    return (
      <>
        <AuthModal open={loginOpen} onClose={() => setLoginOpen(false)} />

        <ValidationModal
          isOpen={showValidationModal}
          onClose={() => {}}
          onSuccess={async () => {
            if (!uid) return;
            try {
              const data = await fetchServerUser(uid);
              setServerUser(data);
            } catch {}
          }}
        />

        <div className="p-6 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-2">Exam Locked</h2>
          <p className="text-gray-600 dark:text-gray-300">
            You already took the exam once. Subscribe (validate) to take
            unlimited exams.
          </p>

          {uid && !validatedReady && (
            <p className="mt-3 text-sm text-gray-500">Checking your account…</p>
          )}
        </div>
      </>
    );
  }

  if (!questions.length) return <p className="p-6">Loading exam...</p>;

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const ss = String(timeLeft % 60).padStart(2, "0");

  return (
    <div className="p-6 pb-24 max-w-3xl mx-auto">
      <IntroModal
        open={introOpen && !submitted}
        totalQuestions={questions.length}
        minutes={15}
        onOk={() => {
          setIntroOpen(false);
          setExamStarted(true);
        }}
      />

      <ResultModal
        open={resultOpen}
        correct={summary.correct}
        wrong={summary.wrong}
        unanswered={summary.unanswered}
        total={summary.total}
        percentage={percentage ?? 0}
        onClose={() => {
          setResultOpen(false);
          setReviewMode(true);
        }}
      />

      <h2 className="text-2xl font-bold mb-4">Take Exam</h2>

      {!submitted && (
        <div className="mb-4 rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3">
          <p className="text-red-700 dark:text-red-200 font-semibold">
            Time Left: {mm}:{ss}
          </p>
        </div>
      )}

      {submitted && (
        <div className="mb-4 rounded-2xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 p-4">
          <h3 className="text-xl font-extrabold mb-1 text-gray-900 dark:text-gray-50">
            Result
          </h3>
          <p className="text-gray-800 dark:text-gray-100">
            Score: <b>{correctCount}</b> / <b>{questions.length}</b>
          </p>
          <p className="text-gray-800 dark:text-gray-100">
            Percentage: <b>{percentage}%</b>
          </p>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        {questions.map((q, idx) => {
          const userAns = answers[q._id];
          const userAnswered = userAns !== undefined;
          const userCorrect = userAnswered && userAns === q.correctAnswer;

          return (
            <div
              key={q._id}
              className="mb-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4 shadow-sm"
            >
              {q.image && (
                <div className="mb-4">
                  <img
                    src={String(q.image).replace(/^"|"$/g, "")}
                    alt={`Question ${idx + 1}`}
                    className="max-w-full rounded-xl border border-gray-200 dark:border-gray-800"
                    onError={(e) => {
                      console.error("Failed to load image:", q.image);
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              )}

              <div
                className="font-semibold mb-3 text-gray-900 dark:text-gray-50"
                style={{ whiteSpace: "pre-line" }}
              >
                {`Q${idx + 1}. ${q.text || ""}`}
              </div>

              <div className="space-y-1">
                {q.options.map((opt, i) => {
                  const isSelected = userAns === i;
                  const isCorrectOption = i === q.correctAnswer;

                  const showReviewColors = submitted && reviewMode;
                  const isWrongSelected =
                    showReviewColors && isSelected && !isCorrectOption;

                  const disabled = !examStarted || submitted;

                  return (
                    <OptionRow
                      key={i}
                      letter={banglaOptions[i]}
                      label={opt}
                      isSelected={isSelected}
                      isCorrectOption={isCorrectOption}
                      isWrongSelected={isWrongSelected}
                      disabled={disabled}
                      showReviewColors={showReviewColors}
                      onSelect={() => handleChange(q._id, i)}
                    />
                  );
                })}
              </div>

              {submitted && reviewMode && (
                <div className="mt-3 text-sm">
                  {!userAnswered ? (
                    <span className="text-gray-500">Unanswered</span>
                  ) : userCorrect ? (
                    <span className="text-green-600 font-semibold">
                      Correct
                    </span>
                  ) : (
                    <span className="text-red-600 font-semibold">Wrong</span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {!submitted && (
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm"
            disabled={!examStarted}
            title={!examStarted ? "Click OK on the popup to start" : undefined}
          >
            Submit Exam
          </button>
        )}
      </form>
    </div>
  );
}
