// TakeExam.jsx
import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { auth } from "../lib/firebase";

/* ===========================================
   Stable Key Helpers (no randomness)
   -------------------------------------------
   1) Prefer q._id or q.id from server
   2) If grouped: use setId + setOrder
   3) Otherwise: hash the essential content
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

export default function TakeExam() {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(900); // 15 min = 900s
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(null);
  const [uid, setUid] = useState(null); // Firebase user UID
  const timerRef = useRef();

  // Change this if your API origin differs in dev/prod
  const API_ORIGIN = "https://ugliest-hannie-ezaz-307892de.koyeb.app";

  // Get current user UID
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setUid(user.uid);
      return;
    }
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (u) setUid(u.uid);
    });
    return unsubscribe;
  }, []);

  /* =========================
     Fetch exams & assemble questions
     1) Try server-assembled endpoint (/exams/assembled)
     2) Fallback to client-side assembly (block-aware)
     NOTE: All questions receive a deterministic, stable _id.
  ========================== */
  useEffect(() => {
    let cancelled = false;

    async function fetchQuestions() {
      try {
        // ---- 1) Try server-side assembly ----
        const assembled = await axios.get(`${API_ORIGIN}/exams/assembled`, {
          params: {
            base: 25, // base per exam
            max: 100, // cap
            absoluteImages: true, // server normalizes image paths
          },
        });

        const list = (assembled.data?.questions || []).map((q) => ({
          ...q,
          _id: stableIdFromQuestion(q),
        }));

        if (!cancelled) setQuestions(list);
        return;
      } catch (e) {
        console.warn(
          "Server assembly not available, falling back to client assembly.",
          e?.message,
        );
      }

      // ---- 2) Fallback: client-side assembly (block-aware) ----
      try {
        const res = await axios.get(`${API_ORIGIN}/exams`);
        const exams = res.data || [];

        const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

        // Build blocks for an exam: arrays of questions
        const buildBlocksForExam = (exam) => {
          const groups = new Map();
          const singles = [];

          for (const q of exam.questions || []) {
            if (q?.setId) {
              if (!groups.has(q.setId)) groups.set(q.setId, []);
              groups.get(q.setId).push(q);
            } else {
              singles.push([q]);
            }
          }

          const blocks = [];
          // sort inside sets by setOrder
          for (const [, arr] of groups.entries()) {
            arr.sort(
              (a, b) =>
                (Number.isFinite(a?.setOrder) ? a.setOrder : 0) -
                (Number.isFinite(b?.setOrder) ? b.setOrder : 0),
            );
            blocks.push(arr);
          }
          // add singles
          blocks.push(...singles);
          return blocks;
        };

        // Pick blocks greedily without splitting; if nothing fits pick the smallest
        const pickBlocks = (blocks, target) => {
          if (target <= 0) return [];
          const pool = shuffle(blocks);
          const picked = [];
          let count = 0;

          for (const block of pool) {
            if (count + block.length <= target) {
              picked.push(block);
              count += block.length;
            }
          }

          // If nothing fit, pick the smallest once to ensure progress
          if (picked.length === 0 && pool.length && target > 0) {
            const smallest = [...pool].sort((a, b) => a.length - b.length)[0];
            picked.push(smallest);
          }

          return picked;
        };

        let allBlocks = [];
        const BASE = 25;

        for (const exam of exams) {
          const blocks = buildBlocksForExam(exam);
          const targetCount = Math.round(
            (BASE * (exam.questionPercentage || 0)) / 100,
          );
          const chosen = pickBlocks(blocks, targetCount);
          allBlocks.push(...chosen);
        }

        // Shuffle blocks globally (keeps internal set order intact)
        allBlocks = shuffle(allBlocks);

        // Cap to 100 without splitting sets
        const MAX_Q = 100;
        const final = [];
        let used = 0;

        for (const block of allBlocks) {
          if (used + block.length <= MAX_Q) {
            final.push(...block);
            used += block.length;
          } else if (used === 0) {
            // If first block alone exceeds cap, include it to avoid empty exam
            final.push(...block);
            break;
          } else {
            // skip block to avoid splitting sets
            continue;
          }
        }

        // Normalize images to absolute and ensure stable _id
        const normalized = final.map((q) => {
          let img = null;
          const src = (q.image || "").trim();

          if (src) {
            if (src.startsWith("/uploads")) img = `${API_ORIGIN}${src}`;
            else if (/^https?:\/\//i.test(src)) img = src;
            else img = `${API_ORIGIN}/${src.replace(/^\/?/, "")}`;
          }

          const withImg = { ...q, image: img };
          return {
            ...withImg,
            _id: stableIdFromQuestion(withImg),
          };
        });

        if (!cancelled) setQuestions(normalized);
      } catch (err) {
        console.error("Failed to load questions:", err);
        if (!cancelled) alert("Error loading questions");
      }
    }

    fetchQuestions();
    return () => {
      cancelled = true;
    };
  }, [API_ORIGIN]);

  // Timer
  useEffect(() => {
    if (!questions.length || submitted) return;

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
  }, [questions, submitted]);

  const handleChange = (qId, optIndex) => {
    setAnswers((prev) => ({ ...prev, [qId]: Number(optIndex) }));
  };

  const handleSubmit = async () => {
    if (submitted) return; // prevent double submit

    let correct = 0;
    questions.forEach((q) => {
      const ans = answers[q._id];
      if (ans !== undefined && ans === q.correctAnswer) correct++;
    });

    const percentage = Number(((correct / questions.length) * 100).toFixed(2));
    setScore(percentage);
    setSubmitted(true);

    if (!uid) {
      console.warn("Cannot update score, UID not found.");
      return;
    }

    try {
      await axios.put(`${API_ORIGIN}/api/users/${uid}/score`, {
        score: percentage, // send numeric score
      });
      console.log("User score updated!");
    } catch (err) {
      console.error("Failed to update user score:", err);
    }
  };

  if (!questions.length) return <p>Loading exam...</p>;

  const minutes = Math.floor(timeLeft / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (timeLeft % 60).toString().padStart(2, "0");

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
            {/* 🖼️ Optional Image */}
            {q.image && (
              <div className="mb-3">
                <img
                  src={q.image}
                  alt={`Question ${idx + 1}`}
                  className="max-h-64 mx-auto object-contain rounded-md border"
                  loading="lazy"
                  onError={(e) => {
                    // hide broken images gracefully to avoid layout jumpiness
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            )}

            {/* ✅ Multiline + Bangla-friendly rendering */}
            <div
              className="font-medium mb-2"
              style={{ whiteSpace: "pre-line" }}
            >
              {`Q${idx + 1}. ${q.text || ""}`}
            </div>

            {/* Options */}
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
