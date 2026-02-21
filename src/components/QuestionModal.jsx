import { useEffect, useState } from "react";
import { getPublicUrl } from "../utils/url";

/**
 * QuestionModal
 * Supports question sets:
 *  - setId: string or null
 *  - setOrder: number (order inside the set)
 */
export default function QuestionModal({ exam, existingQuestion, onSuccess }) {
  const [show, setShow] = useState(false);

  const isEdit = !!existingQuestion;

  // Form state
  const [text, setText] = useState(existingQuestion?.text ?? "");
  const [options, setOptions] = useState(
    existingQuestion?.options ?? ["", "", "", ""],
  );
  const [correctAnswer, setCorrectAnswer] = useState(
    Number.isInteger(existingQuestion?.correctAnswer)
      ? existingQuestion.correctAnswer
      : 0,
  );

  // Set fields
  const [setId, setSetId] = useState(existingQuestion?.setId ?? "");
  const [setOrder, setSetOrder] = useState(
    Number.isFinite(existingQuestion?.setOrder) ? existingQuestion.setOrder : 0,
  );

  // Image state
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState(existingQuestion?.image ?? "");
  const [removeImage, setRemoveImage] = useState(false);
  const [preview, setPreview] = useState("");

  // UX
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Inline Spinner (compact, no blocking overlay)
  const Spinner = ({ className = "w-5 h-5 text-white" }) => (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );

  /* =========================
     Effects
  ========================== */
  useEffect(() => {
    setText(existingQuestion?.text ?? "");
    setOptions(existingQuestion?.options ?? ["", "", "", ""]);
    setCorrectAnswer(
      Number.isInteger(existingQuestion?.correctAnswer)
        ? existingQuestion.correctAnswer
        : 0,
    );

    setSetId(existingQuestion?.setId ?? "");
    setSetOrder(
      Number.isFinite(existingQuestion?.setOrder)
        ? existingQuestion.setOrder
        : 0,
    );

    setImageFile(null);
    setImageUrl(existingQuestion?.image ?? "");
    setRemoveImage(false);
    setPreview("");
    setError("");
    setSubmitting(false);
  }, [existingQuestion, show]);

  useEffect(() => {
    if (!imageFile) {
      setPreview("");
      return;
    }
    const objectUrl = URL.createObjectURL(imageFile);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (show) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [show]);

  /* =========================
     Helpers
  ========================== */
  const updateOption = (i, value) => {
    const copy = [...options];
    copy[i] = value;
    setOptions(copy);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setImageFile(null);
      return;
    }
    const allowed = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!allowed.includes(file.type)) {
      setError("Only JPG, PNG, GIF, WEBP allowed.");
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be <= 5MB.");
      e.target.value = "";
      return;
    }
    setError("");
    setImageFile(file);
    setImageUrl("");
    setRemoveImage(false);
  };

  const validate = () => {
    if (!text.trim()) return "Question text is required.";

    // Require all options to be filled (you can relax this if needed)
    if (options.some((o) => !o.trim())) return "All options must be filled.";

    if (
      !Number.isInteger(correctAnswer) ||
      correctAnswer < 0 ||
      correctAnswer >= options.length
    ) {
      return "Valid correct answer required.";
    }

    if (setId.trim() && !Number.isFinite(Number(setOrder))) {
      return "If setId is provided, setOrder must be a number.";
    }

    return "";
  };

  const send = async (url, init) => {
    const res = await fetch(url, init);
    let data = null;
    try {
      data = await res.json();
    } catch (_) {}
    if (!res.ok) throw new Error(data?.message || `Error ${res.status}`);
    return data;
  };

  /* =========================
     SAVE (Create / Update)
  ========================== */
  const saveQuestion = async () => {
    try {
      setError("");
      const errMsg = validate();
      if (errMsg) return setError(errMsg);

      setSubmitting(true);

      const filled = options.map((o) => o.trim());
      let updatedExam = null;

      const basePayload = {
        text: text.trim(),
        options: filled,
        correctAnswer, // number (JSON case)
        setId: setId.trim() || null,
        setOrder: Number(setOrder) || 0,
      };

      /* ---- CASE 1: Multipart with file ---- */
      if (imageFile) {
        const formData = new FormData();

        // primitives as strings
        formData.set("text", basePayload.text);
        formData.set("correctAnswer", String(basePayload.correctAnswer));

        // options MUST be a single JSON string
        formData.set("options", JSON.stringify(basePayload.options));

        // set fields
        if (setId.trim()) formData.set("setId", setId.trim());
        formData.set("setOrder", String(basePayload.setOrder));

        // file
        formData.set("image", imageFile, imageFile.name);

        const url = isEdit
          ? `https://ugliest-hannie-ezaz-307892de.koyeb.app/exams/${exam._id}/questions/${existingQuestion._id}/upload`
          : `https://ugliest-hannie-ezaz-307892de.koyeb.app/exams/${exam._id}/questions/upload`;

        updatedExam = await send(url, {
          method: isEdit ? "PUT" : "POST",
          body: formData, // DO NOT set Content-Type manually
        });
      } else if (imageUrl.trim()) {
        /* ---- CASE 2: JSON + imageUrl ---- */
        const payload = {
          ...basePayload,
          image: imageUrl.trim(),
        };

        const url = isEdit
          ? `https://ugliest-hannie-ezaz-307892de.koyeb.app/exams/${exam._id}/questions/${existingQuestion._id}`
          : `https://ugliest-hannie-ezaz-307892de.koyeb.app/exams/${exam._id}/questions`;

        updatedExam = await send(url, {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload), // options as array in JSON case
        });
      } else {
        /* ---- CASE 3: No image or remove image ---- */
        const payload = {
          ...basePayload,
          ...(isEdit && removeImage ? { image: null } : {}),
        };

        const url = isEdit
          ? `https://ugliest-hannie-ezaz-307892de.koyeb.app/exams/${exam._id}/questions/${existingQuestion._id}`
          : `https://ugliest-hannie-ezaz-307892de.koyeb.app/exams/${exam._id}/questions`;

        updatedExam = await send(url, {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (updatedExam && onSuccess) onSuccess(updatedExam);
      setShow(false);
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to save question.");
    } finally {
      setSubmitting(false);
    }
  };

  /* =========================
       UI
  ========================== */

  const headerTitle = isEdit ? "Edit Question" : "Add Question";
  const currentImageUrl = existingQuestion?.image
    ? getPublicUrl(existingQuestion.image)
    : "";

  // Optional: close on overlay click
  const handleOverlayClick = () => {
    if (!submitting) setShow(false);
  };

  // Prevent overlay clicks from closing when clicking inside the card
  const stopPropagation = (e) => e.stopPropagation();

  return (
    <>
      <button
        onClick={() => setShow(true)}
        className={`px-3 py-1 ${
          isEdit ? "bg-yellow-500" : "bg-[var(--mm-teal)]"
        } text-white rounded-lg`}
      >
        {isEdit ? "Edit" : "Add Question"}
      </button>

      {show && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 sm:p-6"
          onClick={handleOverlayClick}
        >
          <div
            className="bg-white rounded-xl w-full max-w-[520px] max-h-[90vh] overflow-auto space-y-4 p-4 sm:p-6"
            onClick={stopPropagation}
            role="dialog"
            aria-modal="true"
            aria-label={headerTitle}
            aria-busy={submitting}
          >
            <h3 className="text-lg font-semibold flex items-center gap-2">
              {headerTitle}
              {submitting && (
                <Spinner className="w-4 h-4 text-[var(--mm-teal)]" />
              )}
            </h3>

            {error && (
              <div className="text-sm bg-red-50 text-red-700 px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            {/* Question Text */}
            <label className="block space-y-1">
              <span>প্রশ্ন (Question)</span>
              <textarea
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={submitting}
                className="w-full border rounded-xl p-2 resize-y disabled:opacity-60"
              />
            </label>

            {/* Options */}
            <div className="space-y-2">
              <div className="font-medium">Options</div>
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    className="w-full border rounded-xl p-2 disabled:opacity-60"
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value)}
                    disabled={submitting}
                  />
                  <input
                    type="radio"
                    name="correct"
                    checked={correctAnswer === i}
                    onChange={() => setCorrectAnswer(i)}
                    disabled={submitting}
                    aria-label={`Mark option ${i + 1} as correct`}
                  />
                </div>
              ))}
            </div>

            {/* Set ID */}
            <label className="block space-y-1">
              <span className="font-medium">Set ID (optional)</span>
              <input
                type="text"
                value={setId}
                onChange={(e) => {
                  const v = e.target.value;
                  setSetId(v);
                  if (!v.trim()) setSetOrder(0); // auto-reset
                }}
                placeholder="Example: passage-001"
                disabled={submitting}
                className="w-full border rounded-xl p-2 disabled:opacity-60"
              />
            </label>

            {/* Set Order */}
            <label className="block space-y-1">
              <span className="font-medium">Set Order</span>
              <input
                type="number"
                value={setOrder}
                onChange={(e) => setSetOrder(Number(e.target.value))}
                disabled={!setId.trim() || submitting}
                className="w-full border rounded-xl p-2 disabled:opacity-60"
              />
            </label>

            {/* Image Section */}
            <div className="space-y-2 border p-3 rounded-xl">
              <div className="font-medium">Optional Image</div>

              {isEdit &&
                currentImageUrl &&
                !preview &&
                !imageFile &&
                !imageUrl && (
                  <img
                    src={currentImageUrl}
                    className="max-h-40 w-auto rounded border object-contain"
                    alt="current"
                  />
                )}

              {preview && (
                <img
                  src={preview}
                  className="max-h-40 w-auto rounded border object-contain"
                  alt="preview"
                />
              )}

              {imageUrl && !preview && !imageFile && (
                <img
                  src={getPublicUrl(imageUrl)}
                  className="max-h-40 w-auto rounded border object-contain"
                  alt="URL preview"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              )}

              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={submitting}
                className="disabled:opacity-60"
              />

              <input
                type="url"
                className="w-full border rounded-xl p-2 disabled:opacity-60"
                value={imageUrl}
                onChange={(e) => {
                  const v = e.target.value.trimStart();
                  setImageUrl(v);
                  if (v) setImageFile(null);
                }}
                disabled={submitting}
                placeholder="Paste image URL"
              />

              {isEdit && existingQuestion?.image && !imageFile && !imageUrl && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={removeImage}
                    onChange={(e) => setRemoveImage(e.target.checked)}
                    disabled={submitting}
                  />
                  Remove existing image
                </label>
              )}
            </div>

            {/* Sticky actions */}
            <div className="sticky bottom-0 bg-white pt-2">
              <button
                onClick={saveQuestion}
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 bg-[var(--mm-teal)] text-white py-2 rounded-xl disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Spinner />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </button>

              <button
                onClick={() => setShow(false)}
                disabled={submitting}
                className="w-full mt-2 py-2 border rounded-xl disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
``;
