import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export default function FirstTimeGuide({
  storageKey = "ictmm_first_time_guide_done",
}) {
  const steps = useMemo(
    () => [
      {
        type: "welcome",
        title: "Welcome to ICT Master Mind",
        text: "Welcome to ICT Master Mind. You can get access to notes for HSC preparation and take mock exams for practice.",
        img: "/mastermind-logo.png", // from /public
      },
      {
        type: "social",
        title: "Visit Us Online",
        text: "Visit us for more contents and information",
        facebookUrl: "https://www.facebook.com/ictmastermindbd",
        websiteUrl: "https://www.ictmastermind.com",
        // Online PNG icons (stable sources)
        facebookIcon:
          "https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg",
        websiteIcon: "https://cdn-icons-png.flaticon.com/512/1006/1006771.png",
      },
      {
        type: "image",
        title: "Dashboard",
        text: "Press Home to go to dashboard",
        img: "/onboarding/home.jpg",
      },
      {
        type: "image",
        title: "My Notes",
        text: "Press My Notes to read notes",
        img: "/onboarding/notes.jpg",
      },
      {
        type: "image",
        title: "Announcements",
        text: "Press Announcement to check latest announcements",
        img: "/onboarding/announcements.jpg",
      },
      {
        type: "image",
        title: "Take Exam",
        text: "Press Take Exam to participate in exam",
        img: "/onboarding/exam.jpg",
      },
      {
        type: "image",
        title: "Dashboard",
        text: "You can see your progress and new announcements & notes in dashboard",
        img: "/onboarding/dashboard.jpg",
      },
    ],
    [],
  );

  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  // Show only on first visit
  useEffect(() => {
    const done = localStorage.getItem(storageKey);
    if (!done) setOpen(true);
  }, [storageKey]);

  const closeAndRemember = () => {
    localStorage.setItem(storageKey, "1");
    setOpen(false);
  };

  const next = () => {
    if (idx >= steps.length - 1) closeAndRemember();
    else setIdx((v) => v + 1);
  };

  const back = () => setIdx((v) => Math.max(0, v - 1));

  if (!open) return null;

  const step = steps[idx];

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        role="dialog"
        aria-modal="true"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60"
          onClick={closeAndRemember}
        />

        {/* Modal */}
        <motion.div
          className="relative z-10 w-[92%] max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-gray-200 dark:bg-gray-900 dark:border-gray-800"
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
        >
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            Step {idx + 1} / {steps.length}
          </div>

          <h3 className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            {step.title}
          </h3>

          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
            {step.text}
          </p>

          {/* CONTENT AREA */}
          {step.type === "social" ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {/* Facebook */}
              <a
                href={step.facebookUrl}
                target="_blank"
                rel="noreferrer"
                className="group flex flex-col items-center justify-center rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-4 hover:shadow-md transition"
              >
                <div className="h-12 w-12 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-center">
                  <img
                    src={step.facebookIcon}
                    alt="Facebook"
                    className="h-7 w-7 object-contain"
                    draggable="false"
                  />
                </div>
                <div className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Facebook
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Open page
                </div>
              </a>

              {/* Website */}
              <a
                href={step.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="group flex flex-col items-center justify-center rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-4 hover:shadow-md transition"
              >
                <div className="h-12 w-12 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-center">
                  <img
                    src={step.websiteIcon}
                    alt="Website"
                    className="h-7 w-7 object-contain"
                    draggable="false"
                  />
                </div>
                <div className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Website
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Visit site
                </div>
              </a>
            </div>
          ) : (
            // Default JPG/PNG preview (no crop)
            <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-2">
              <div className="h-44 w-full overflow-hidden rounded-lg flex items-center justify-center">
                <img
                  src={step.img}
                  alt={step.title}
                  className="max-h-full max-w-full object-contain"
                  draggable="false"
                />
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              onClick={back}
              disabled={idx === 0}
            >
              Back
            </button>

            <div className="flex items-center gap-2">
              <button
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                onClick={next}
              >
                {idx === steps.length - 1 ? "Finish" : "Next"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
