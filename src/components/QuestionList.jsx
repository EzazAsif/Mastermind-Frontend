import React, { useMemo } from "react";
import { getPublicUrl } from "../utils/url";

export default function QuestionList({ exam, onEdit }) {
  const questions = Array.isArray(exam?.questions) ? exam.questions : [];

  // Group into blocks by setId; singles = their own block
  const blocks = useMemo(() => {
    if (!questions.length) return [];

    const sets = new Map(); // setId -> [q, ...]
    const singles = [];

    for (const q of questions) {
      const sid = (q?.setId || "").trim();
      if (sid) {
        if (!sets.has(sid)) sets.set(sid, []);
        sets.get(sid).push(q);
      } else {
        singles.push([q]);
      }
    }

    const grouped = [];

    // Push set blocks (sort internally by setOrder)
    for (const [sid, arr] of sets.entries()) {
      arr.sort(
        (a, b) =>
          (Number.isFinite(a?.setOrder) ? a.setOrder : 0) -
          (Number.isFinite(b?.setOrder) ? b.setOrder : 0),
      );
      grouped.push({ type: "set", setId: sid, items: arr });
    }

    // Push single blocks
    for (const arr of singles) {
      grouped.push({ type: "single", setId: null, items: arr });
    }

    // NOTE: We’re not reordering blocks here—this view reflects your stored order.
    // If you want to sort sets alphabetically or by first question index, you can do so here.

    return grouped;
  }, [questions]);

  if (!questions.length) {
    return (
      <div className="text-gray-500 dark:text-gray-400">No questions yet.</div>
    );
  }

  // For a global sequential index across blocks
  let runningIndex = 0;

  return (
    <div className="space-y-6">
      {blocks.map((block, bIdx) => {
        const isSet = block.type === "set";
        const headerLabel = isSet
          ? `Set: ${block.setId} (${block.items.length})`
          : `Single Question`;

        return (
          <div
            key={`${block.setId || "single"}-${bIdx}`}
            className="rounded-2xl border border-gray-200 dark:border-gray-700"
          >
            {/* Block Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50 dark:bg-gray-800/40 dark:border-gray-700 rounded-t-2xl">
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                {headerLabel}
              </div>

              {/* Optional chips for setId */}
              {isSet && (
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                    setId: {block.setId}
                  </span>
                </div>
              )}
            </div>

            {/* Block Items */}
            <div className="p-4 space-y-4">
              {block.items.map((q) => {
                const myIndex = ++runningIndex;

                return (
                  <div
                    key={q._id || `${block.setId || "single"}-${myIndex}`}
                    className="border rounded-xl p-4 dark:border-gray-700"
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 select-none">
                        Q{myIndex}.
                      </div>

                      <div className="flex-1 space-y-3">
                        {/* Question text */}
                        <div
                          className="text-base font-medium whitespace-pre-line"
                          // If your text contains manual line breaks, keep them
                        >
                          {q.text}
                        </div>

                        {/* Badges for metadata */}
                        <div className="flex flex-wrap items-center gap-2">
                          {q.setId && (
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              setId: {q.setId}
                            </span>
                          )}
                          {Number.isFinite(q?.setOrder) && q.setId && (
                            <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                              setOrder: {q.setOrder}
                            </span>
                          )}
                          <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            Correct: {Number(q.correctAnswer) + 1}
                          </span>
                        </div>

                        {/* Optional Image */}
                        {q.image ? (
                          <div>
                            <img
                              src={getPublicUrl(q.image)}
                              alt={`Question ${myIndex}`}
                              className="max-h-48 w-full object-contain rounded-md border bg-white dark:bg-gray-900"
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
                          </div>
                        ) : null}

                        {/* Options */}
                        <ol className="list-decimal ml-6 space-y-1">
                          {q.options.map((opt, i) => {
                            const isCorrect = i === q.correctAnswer;
                            return (
                              <li
                                key={i}
                                className={
                                  isCorrect
                                    ? "font-semibold text-emerald-600"
                                    : ""
                                }
                              >
                                {opt}
                                {isCorrect && (
                                  <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
                                    Correct
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ol>

                        {/* Edit Button */}
                        {onEdit && (
                          <div className="pt-2">
                            <button
                              onClick={() => onEdit(q)}
                              className="px-3 py-1 bg-yellow-500 text-white rounded-lg"
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
