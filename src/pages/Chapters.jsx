import { useEffect, useMemo, useState } from "react";
import QuestionModal from "../components/QuestionModal";
import { getPublicUrl } from "../utils/url"; // resolves /uploads/... to https://ugliest-hannie-ezaz-307892de.koyeb.app/uploads/...

/* =========================
   STABLE KEY HELPERS
========================= */
function djb2(str = "") {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  return (h >>> 0).toString(36); // unsigned & compact
}

// Hash a question by stable, immutable content
function hashQuestion(q) {
  const base = [
    q?.text ?? "",
    Array.isArray(q?.options) ? q.options.join("|") : "",
    q?.image ?? "",
    q?.setId ?? "",
    Number.isFinite(q?.setOrder) ? String(q.setOrder) : "",
  ].join("||");
  return `q-${djb2(base)}`;
}

// Prefer backend ids, fallback to content hashes
function stableQuestionId(q) {
  return String(q?.id || q?._id || hashQuestion(q));
}

function hashChapter(ch) {
  const base = [
    ch?.title ?? "",
    Number.isFinite(ch?.questionPercentage)
      ? String(ch.questionPercentage)
      : "",
    Array.isArray(ch?.questions) ? String(ch.questions.length) : "",
  ].join("||");
  return `ch-${djb2(base)}`;
}

function stableChapterId(ch) {
  return String(ch?.id || ch?._id || hashChapter(ch));
}

/* =========================
   NORMALIZATION HELPERS
   - Ensure both id and _id exist
   - Normalize nested questions too
========================= */
function normalizeQuestion(q) {
  const id = q?.id ?? q?._id ?? null;
  return { ...q, id, _id: id };
}

function normalizeChapter(ch) {
  const id = ch?.id ?? ch?._id ?? null;
  const qs = Array.isArray(ch?.questions)
    ? ch.questions.map(normalizeQuestion)
    : [];
  return { ...ch, id, _id: id, questions: qs };
}

/* =========================
   COMPONENT
========================= */
export default function Chapters() {
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [editingChapter, setEditingChapter] = useState(null);
  const [chapterTitle, setChapterTitle] = useState("");
  const [questionPercentage, setQuestionPercentage] = useState("");

  /* =========================
     FETCH CHAPTERS
  ========================== */
  const fetchChapters = async () => {
    try {
      const raw = await fetch(
        "https://ugliest-hannie-ezaz-307892de.koyeb.app/exams",
      ).then((res) => res.json());
      const data = (Array.isArray(raw) ? raw : []).map(normalizeChapter);

      setChapters(data || []);

      if (selectedChapter) {
        const updated = (data || []).find((c) => c.id === selectedChapter.id);
        setSelectedChapter(updated || null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchChapters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =========================
     SAVE CHAPTER (ADD / EDIT)
  ========================== */
  const saveChapter = async () => {
    const percentage = Number(questionPercentage);

    if (!chapterTitle.trim()) return alert("Enter chapter name");
    if (isNaN(percentage) || percentage < 0 || percentage > 100)
      return alert("Enter a valid question percentage (0-100)");

    try {
      let updatedChapter;
      const payload = {
        title: chapterTitle.trim(),
        questionPercentage: percentage,
      };

      if (editingChapter?.id) {
        updatedChapter = await fetch(
          `https://ugliest-hannie-ezaz-307892de.koyeb.app/exams/${editingChapter.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        ).then((res) => res.json());

        // Normalize in case backend returns only _id (or only id)
        const normalized = normalizeChapter(updatedChapter);

        setChapters((prev) =>
          prev.map((c) => (c.id === normalized.id ? normalized : c)),
        );

        if (selectedChapter?.id === normalized.id)
          setSelectedChapter(normalized);
      } else {
        updatedChapter = await fetch(
          "https://ugliest-hannie-ezaz-307892de.koyeb.app/exams",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        ).then((res) => res.json());

        const normalized = normalizeChapter(updatedChapter);
        setChapters((prev) => [...prev, normalized]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setShowChapterModal(false);
      setChapterTitle("");
      setQuestionPercentage("");
      setEditingChapter(null);
    }
  };

  /* =========================
     DELETE CHAPTER
  ========================== */
  const deleteChapter = async (id) => {
    if (!id) return;
    try {
      await fetch(
        `https://ugliest-hannie-ezaz-307892de.koyeb.app/exams/${id}`,
        { method: "DELETE" },
      );
      setChapters((prev) => prev.filter((c) => c.id !== id));
      if (selectedChapter?.id === id) setSelectedChapter(null);
    } catch (err) {
      console.error(err);
    }
  };

  /* =========================
     DELETE QUESTION
  ========================== */
  const deleteQuestion = async (questionId) => {
    if (!selectedChapter?.id || !questionId) return;
    try {
      const updated = await fetch(
        `https://ugliest-hannie-ezaz-307892de.koyeb.app/exams/${selectedChapter.id}/questions/${questionId}`,
        { method: "DELETE" },
      ).then((res) => res.json());

      if (!updated) return;
      const resolved = normalizeChapter(updated.exam || updated);

      setSelectedChapter(resolved);
      setChapters((prev) =>
        prev.map((c) => (c.id === resolved.id ? resolved : c)),
      );

      // Defensive: ensure we reflect server truth
      await fetchChapters();
    } catch (err) {
      console.error(err);
    }
  };

  /* =========================
     GROUP QUESTIONS BY SET (with stable keys)
  ========================== */
  const blocks = useMemo(() => {
    const questions = Array.isArray(selectedChapter?.questions)
      ? selectedChapter.questions
      : [];
    if (!questions.length) return [];

    const setMap = new Map(); // setId -> Question[]
    const singles = [];

    for (const q of questions) {
      const sid = (q?.setId || "").trim();
      if (sid) {
        if (!setMap.has(sid)) setMap.set(sid, []);
        setMap.get(sid).push(q);
      } else {
        // keep as [q] so later logic still works
        singles.push([q]);
      }
    }

    const grouped = [];

    // Build set blocks with stable block keys
    for (const [sid, arr] of setMap.entries()) {
      arr.sort(
        (a, b) =>
          (Number.isFinite(a?.setOrder) ? a.setOrder : 0) -
          (Number.isFinite(b?.setOrder) ? b.setOrder : 0),
      );
      grouped.push({ type: "set", setId: sid, items: arr, key: `set:${sid}` });
    }

    // Build single-question blocks with stable keys
    for (const arr of singles) {
      const q = arr[0];
      const qKey = stableQuestionId(q);
      grouped.push({
        type: "single",
        setId: null,
        items: arr,
        key: `single:${qKey}`,
      });
    }

    // Keep DB order; if you want, sort grouped here.
    return grouped;
  }, [selectedChapter]);

  /* =========================
     JSX
  ========================== */
  return (
    <div className="p-6">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Chapters</h1>
        <button
          onClick={() => {
            setEditingChapter(null);
            setChapterTitle("");
            setQuestionPercentage("");
            setShowChapterModal(true);
          }}
          className="px-4 py-2 bg-[var(--mm-teal)] text-white rounded-xl"
        >
          + Add Chapter
        </button>
      </div>

      {/* CHAPTER CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {chapters.map((chapter) => (
          <div
            key={stableChapterId(chapter)} // ✅ stable key
            className="p-5 rounded-2xl bg-white dark:bg-gray-900 shadow"
          >
            <div
              onClick={() => setSelectedChapter(chapter)}
              className="cursor-pointer"
            >
              <h3 className="font-semibold text-lg">{chapter.title}</h3>
              <p className="text-sm text-gray-500">
                {chapter.questions?.length || 0} Questions
              </p>
              <p className="text-sm text-gray-400">
                Question Percentage: {chapter.questionPercentage}%
              </p>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  setEditingChapter(chapter);
                  setChapterTitle(chapter.title);
                  setQuestionPercentage(
                    String(chapter.questionPercentage ?? ""),
                  );
                  setShowChapterModal(true);
                }}
                className="px-3 py-1 bg-yellow-500 text-white rounded-lg"
              >
                Edit
              </button>

              <button
                onClick={() => deleteChapter(chapter.id)}
                className="px-3 py-1 bg-red-500 text-white rounded-lg"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* CHAPTER DETAIL VIEW */}
      {selectedChapter && (
        <div className="mt-10 bg-white dark:bg-gray-900 p-6 rounded-2xl shadow">
          <div className="flex flex-wrap items-center gap-3 justify-between mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">{selectedChapter.title}</h2>
              <p className="text-gray-500">
                Question Percentage: {selectedChapter.questionPercentage}%
              </p>
            </div>

            {/* Always-visible Add Question button in header */}
            <QuestionModal
              exam={selectedChapter}
              onSuccess={async (updatedChapter) => {
                if (!updatedChapter) return;
                const resolved = normalizeChapter(
                  updatedChapter.exam || updatedChapter,
                );
                setSelectedChapter(resolved);
                setChapters((prev) =>
                  prev.map((c) => (c.id === resolved.id ? resolved : c)),
                );
                await fetchChapters(); // ensure sync
              }}
            />

            <button
              onClick={() => setSelectedChapter(null)}
              className="px-4 py-2 border rounded-xl"
            >
              Back
            </button>
          </div>

          {/* Grouped blocks view */}
          {!blocks.length ? (
            <div className="text-gray-500 dark:text-gray-400">
              No questions yet.
            </div>
          ) : (
            <div className="space-y-6">
              {(() => {
                let globalIdx = 0; // used for display only (not keys)
                return blocks.map((block) => {
                  const isSet = block.type === "set";
                  const headerLabel = isSet
                    ? `Set: ${block.setId} (${block.items.length})`
                    : "Single Question";

                  return (
                    <div
                      key={block.key} // ✅ stable block key
                      className="rounded-2xl border border-gray-200 dark:border-gray-700"
                    >
                      {/* Block header */}
                      <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50 dark:bg-gray-800/40 dark:border-gray-700 rounded-t-2xl">
                        <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                          {headerLabel}
                        </div>
                        {isSet && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                            setId: {block.setId}
                          </span>
                        )}
                      </div>

                      {/* Items in the block */}
                      <div className="p-4 space-y-4">
                        {block.items.map((q) => {
                          const myIndex = ++globalIdx; // label only
                          const resolvedImage = q.image
                            ? getPublicUrl(q.image)
                            : "";
                          const qKey = stableQuestionId(q); // ✅ stable per-question key

                          return (
                            <div
                              key={qKey} // ✅ stable key
                              className="border rounded-xl p-4 dark:border-gray-700"
                            >
                              <div className="flex items-start gap-3">
                                <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 select-none">
                                  Q{myIndex}.
                                </div>

                                <div className="flex-1 space-y-3">
                                  {/* Question text */}
                                  <h4 className="font-medium whitespace-pre-line">
                                    {q.text}
                                  </h4>

                                  {/* Badges */}
                                  <div className="flex flex-wrap items-center gap-2">
                                    {q.setId && (
                                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                        setId: {q.setId}
                                      </span>
                                    )}
                                    {Number.isFinite(q?.setOrder) &&
                                      q.setId && (
                                        <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                          setOrder: {q.setOrder}
                                        </span>
                                      )}
                                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                      Correct: {Number(q.correctAnswer) + 1}
                                    </span>
                                  </div>

                                  {/* 🖼️ Image if present */}
                                  {q.image && (
                                    <img
                                      src={resolvedImage}
                                      alt={`Question ${myIndex}`}
                                      className="mb-3 max-h-48 w-full object-contain rounded-md border bg-white"
                                      loading="lazy"
                                      onError={(e) => {
                                        e.currentTarget.onerror = null;
                                        e.currentTarget.src =
                                          "data:image/svg+xml;charset=utf-8," +
                                          encodeURIComponent(
                                            `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='160'>
                                               <rect width='100%' height='100%' fill='#f3f4f6'/>
                                               <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
                                                     fill='#6b7280' font-family='sans-serif' font-size='14'>
                                                 Image failed to load
                                               </text>
                                             </svg>`,
                                          );
                                      }}
                                    />
                                  )}

                                  {/* Options */}
                                  <ul className="space-y-1 mb-3">
                                    {(Array.isArray(q.options)
                                      ? q.options
                                      : []
                                    ).map((opt, i) => (
                                      <li
                                        key={`${qKey}-opt-${i}`} // ✅ stable per-question option key
                                        className={`px-2 py-1 rounded ${
                                          i === q.correctAnswer
                                            ? "bg-green-100 dark:bg-green-800"
                                            : ""
                                        }`}
                                      >
                                        {opt}
                                      </li>
                                    ))}
                                  </ul>

                                  {/* Actions */}
                                  <div className="flex gap-3">
                                    <QuestionModal
                                      exam={selectedChapter}
                                      existingQuestion={q}
                                      onSuccess={async (updatedChapter) => {
                                        if (!updatedChapter) return;
                                        const resolved = normalizeChapter(
                                          updatedChapter.exam || updatedChapter,
                                        );
                                        setSelectedChapter(resolved);
                                        setChapters((prev) =>
                                          prev.map((c) =>
                                            c.id === resolved.id ? resolved : c,
                                          ),
                                        );
                                        await fetchChapters();
                                      }}
                                    />
                                    <button
                                      onClick={() => deleteQuestion(q.id)}
                                      className="px-3 py-1 bg-red-500 text-white rounded-lg"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}

              {/* Add Question — visible at bottom too */}
              <div className="pt-2">
                <QuestionModal
                  exam={selectedChapter}
                  onSuccess={async (updatedChapter) => {
                    if (!updatedChapter) return;
                    const resolved = normalizeChapter(
                      updatedChapter.exam || updatedChapter,
                    );
                    setSelectedChapter(resolved);
                    setChapters((prev) =>
                      prev.map((c) => (c.id === resolved.id ? resolved : c)),
                    );
                    await fetchChapters();
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ADD / EDIT CHAPTER MODAL */}
      {showChapterModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl w-[400px] space-y-4">
            <h3 className="text-lg font-semibold">
              {editingChapter ? "Edit Chapter" : "Add Chapter"}
            </h3>

            <input
              type="text"
              value={chapterTitle}
              onChange={(e) => setChapterTitle(e.target.value)}
              placeholder="Chapter name"
              className="w-full border rounded-xl p-2"
            />

            <input
              type="number"
              min={0}
              max={100}
              value={questionPercentage}
              onChange={(e) => setQuestionPercentage(e.target.value)}
              placeholder="Question Percentage (0-100)"
              className="w-full border rounded-xl p-2"
            />

            <button
              onClick={saveChapter}
              className="w-full py-2 bg-[var(--mm-teal)] text-white rounded-xl"
            >
              Save
            </button>

            <button
              onClick={() => setShowChapterModal(false)}
              className="w-full py-2 border rounded-xl"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
