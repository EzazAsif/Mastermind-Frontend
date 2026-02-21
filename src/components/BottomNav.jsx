import { motion } from "framer-motion";
import { TABS } from "../navTabs";

export default function BottomNav({ route, onChange, user }) {
  const alwaysVisible = ["student", "announcements", "Notes"];
  const adminTabs = [
    "addAnnouncement",
    "acceptRequest",
    "ManageChapters",
    "uploadPdf",
    "analytics",
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 h-[var(--bottom-nav-h)] bg-white dark:bg-gray-950 border-t border-[var(--mm-border)] shadow-lg lg:hidden flex justify-between items-center px-2"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Bottom navigation"
    >
      {TABS.filter((t) => {
        if (t.id === "ViewPdf") return false;
        if (t.id === "takeExam" && !user?.is_validated) return false;
        if (adminTabs.includes(t.id) && !user?.is_Admin) return false;
        if (alwaysVisible.includes(t.id)) return true;
        if (!user) return false;
        return true;
      }).map((t) => {
        const active = route === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2 relative"
          >
            <span
              className={`text-lg ${active ? "text-teal-500" : "text-gray-400 dark:text-gray-500"}`}
            >
              {t.icon}
            </span>
            <span
              className={`text-xs ${active ? "text-teal-500 font-medium" : "text-gray-400 dark:text-gray-500"}`}
            >
              {t.label}
            </span>
            {active && (
              <motion.span
                layoutId="active-pill"
                className="absolute -top-1 w-2 h-2 rounded-full bg-teal-500"
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
