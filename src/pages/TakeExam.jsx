// TakeExam.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { auth } from "../lib/firebase";
import ValidationModal from "../components/ValidationModal.jsx";
import AuthModal from "../components/AuthModal.jsx";

/* ===========================================
   Stable Key Helpers (no randomness)
=========================================== */
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

export default function TakeExam() {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(900);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(null);

  const [authReady, setAuthReady] = useState(false);
  const [uid, setUid] = useState(null);

  const [serverUser, setServerUser] = useState(null);
  const [userLoading, setUserLoading] = useState(false);

  const [loginOpen, setLoginOpen] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);

  const timerRef = useRef();

  const API_ORIGIN = "https://ugliest-hannie-ezaz-307892de.koyeb.app";
  const EXAM_TAKEN_KEY = "exam_taken";

  // ---- Auth: optional (exam can run without login) ----
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setUid(u?.uid || null);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  // ---- Fetch server user ONLY if logged in ----
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

  // ---- Derived rules ----
  const examTaken = useMemo(() => readExamTaken(EXAM_TAKEN_KEY), [submitted]);

  // We only *know* validation status after fetch finishes when logged in.
  // If not logged in, it's immediately known (not validated).
  const validatedReady = useMemo(() => {
    if (!uid) return true;
    return !userLoading;
  }, [uid, userLoading]);

  const validated = useMemo(() => {
    if (!uid) return false; // not logged in -> cannot be validated
    if (!validatedReady) return false; // unknown yet
    return isUserValidated(serverUser);
  }, [uid, validatedReady, serverUser]);

  // ✅ Allow exam if:
  // - validated user (always)
  // - OR flag not taken yet (everyone once)
  // - OR just submitted in this session (so they can see score/result)
  const canTakeExam = validated || !examTaken || submitted;

  // ✅ Block only if:
  // - flag taken AND NOT validated
  // - AND NOT currently showing result
  // - AND validation status is READY (prevents instant popup while loading)
  const shouldBlock = examTaken && !validated && !submitted && validatedReady;

  // ---- Modal behavior when blocked ----
  useEffect(() => {
    if (!shouldBlock) {
      setShowValidationModal(false);
      setLoginOpen(false);
      return;
    }

    // blocked + NOT logged in -> show login modal
    if (!uid) {
      setLoginOpen(true);
      setShowValidationModal(false);
      return;
    }

    // blocked + logged in -> wait until user fetch completes
    if (!validatedReady) return;

    setShowValidationModal(true);
    setLoginOpen(false);
  }, [shouldBlock, uid, validatedReady]);

  // Modal open failure log (only when it SHOULD open)
  useEffect(() => {
    if (!shouldBlock) return;

    if (!uid && !loginOpen) {
      console.log("[MODAL OPEN FAIL] expected AuthModal", {
        examTaken,
        validated,
        uid,
        serverUser,
        userLoading,
        localStorage: localStorage.getItem(EXAM_TAKEN_KEY),
      });
    }

    if (uid && validatedReady && !showValidationModal) {
      console.log("[MODAL OPEN FAIL] expected ValidationModal", {
        examTaken,
        validated,
        uid,
        serverUser,
        userLoading,
        localStorage: localStorage.getItem(EXAM_TAKEN_KEY),
      });
    }
  }, [
    shouldBlock,
    uid,
    validatedReady,
    showValidationModal,
    loginOpen,
    examTaken,
    validated,
    serverUser,
    userLoading,
  ]);

  // ---- Fetch questions if allowed (no need for login) ----
  useEffect(() => {
    let cancelled = false;

    async function fetchQuestions() {
      if (!canTakeExam) return;

      try {
        const assembled = await axios.get(`${API_ORIGIN}/exams/assembled`, {
          params: { base: 25, max: 100, absoluteImages: true },
        });

        const list = (assembled.data?.questions || []).map((q) => ({
          ...q,
          _id: stableIdFromQuestion(q),
        }));

        if (!cancelled) setQuestions(list);
      } catch {
        if (!cancelled) alert("Failed to load exam");
      }
    }

    fetchQuestions();
    return () => {
      cancelled = true;
    };
  }, [API_ORIGIN, canTakeExam]);

  // ---- Timer ----
  useEffect(() => {
    if (!questions.length || submitted) return;
    if (!canTakeExam) return;

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
  }, [questions, submitted, canTakeExam]);

  const handleChange = (qId, optIndex) => {
    setAnswers((prev) => ({ ...prev, [qId]: Number(optIndex) }));
  };

  // ---- Submit: set flag always; update score only if logged in ----
  const handleSubmit = async () => {
    if (submitted) return;

    // set the "taken" flag immediately
    writeExamTaken(EXAM_TAKEN_KEY);

    let correct = 0;
    questions.forEach((q) => {
      const ans = answers[q._id];
      if (ans !== undefined && ans === q.correctAnswer) correct++;
    });

    const percentage = Number(((correct / questions.length) * 100).toFixed(2));
    setScore(percentage);
    setSubmitted(true);

    // Only update score if logged in
    if (!uid) return;

    try {
      await axios.put(`${API_ORIGIN}/api/users/${uid}/score`, {
        score: percentage,
      });
    } catch {}
  };

  // -----------------------
  // UI
  // -----------------------
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
          <p className="text-gray-600">
            You already took the exam once. Subscribe (validate) to take
            unlimited exams.
          </p>

          {/* optional: show loading state if logged in and checking */}
          {uid && !validatedReady && (
            <p className="mt-3 text-sm text-gray-500">Checking your account…</p>
          )}
        </div>
      </>
    );
  }

  if (!questions.length) return <p className="p-6">Loading exam...</p>;

  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const seconds = String(timeLeft % 60).padStart(2, "0");

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Take Exam</h2>

      {!submitted && (
        <p className="mb-4 text-red-600 font-semibold">
          Time Left: {minutes}:{seconds}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          clearInterval(timerRef.current);
          handleSubmit();
        }}
      >
        {questions.map((q, idx) => (
          <div key={q._id} className="mb-6 border p-4 rounded-lg">
            <div
              className="font-medium mb-2"
              style={{ whiteSpace: "pre-line" }}
            >
              {`Q${idx + 1}. ${q.text || ""}`}
            </div>

            {q.options.map((opt, i) => (
              <label key={i} className="block mb-1 cursor-pointer">
                <input
                  type="radio"
                  name={q._id}
                  value={i}
                  disabled={submitted}
                  checked={answers[q._id] === i}
                  onChange={() => handleChange(q._id, i)}
                  className="mr-2"
                />
                {opt}
              </label>
            ))}
          </div>
        ))}

        {!submitted && (
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Submit Exam
          </button>
        )}
      </form>

      {submitted && (
        <div className="mt-6 p-4 border rounded bg-green-50">
          <h3 className="text-xl font-bold mb-2">Exam Result</h3>
          <p>Score: {score} / 100</p>
          <p>Percentage: {score}%</p>
        </div>
      )}
    </div>
  );
}
