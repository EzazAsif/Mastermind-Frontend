import { motion } from "framer-motion";
import { TABS } from "../navTabs";

export default function Sidebar({ route, onChange, user }) {
  // Tabs always visible for guests
  const alwaysVisible = ["student", "announcements", "Notes"];

  // Admin-only tabs
  const adminTabs = [
    "analytics",
    "uploadPdf",
    "addAnnouncement",
    "acceptRequest",
    "ManageChapters",
  ];

  return (
    <aside className="sticky top-[56px] self-start p-3">
      <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-soft p-2 w-[240px]">
        <ul className="space-y-1">
          {TABS.filter((t) => {
            if (t.id === "ViewPdf") return false; // hide ViewPdf

            // takeExam only if validated
            if (t.id === "takeExam" && !user?.is_validated) return false;

            // Admin-only tabs
            if (adminTabs.includes(t.id) && !user?.is_Admin) return false;

            // Always show certain tabs even for guests
            if (alwaysVisible.includes(t.id)) return true;

            // Otherwise hide if no user
            if (!user) return false;

            return true;
          }).map((t) => {
            const active = route === t.id;
            return (
              <li key={t.id}>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onChange(t.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl font-medium flex items-center gap-2
                    ${
                      active
                        ? "bg-brand/10 text-brand"
                        : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                >
                  <span className="text-lg">{t.icon}</span>
                  <span>{t.label}</span>
                </motion.button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
