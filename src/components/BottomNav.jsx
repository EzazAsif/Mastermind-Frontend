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
      className="fixed inset-x-0 bottom-0 z-30 h-[var(--bottom-nav-h)]
      bg-white dark:bg-gray-950 border-t border-[var(--mm-border)] shadow-lg
      lg:hidden flex items-center"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Bottom navigation"
    >
      {TABS.filter((t) => {
        if (t.id === "ViewPdf") return false;
        if (t.id === "takeExam") return true;
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
            className="
              flex-1 min-w-0
              flex flex-col items-center justify-center
              gap-[2px] max-[360px]:gap-[1px]
              py-[6px] max-[360px]:py-[3px]
              relative
            "
          >
            {/* icon */}
            <span
              className={`
                text-[18px] max-[360px]:text-[16px]
                ${active ? "text-teal-500" : "text-gray-400 dark:text-gray-500"}
              `}
            >
              {t.icon}
            </span>

            {/* label (real truncation) */}
            <span
              className={`
                w-full min-w-0
                px-1
                text-[11px] max-[360px]:text-[9px]
                leading-[12px] max-[360px]:leading-[10px]
                text-center
                overflow-hidden text-ellipsis whitespace-nowrap
                ${active ? "text-teal-500 font-medium" : "text-gray-400 dark:text-gray-500"}
              `}
              title={t.label}
            >
              {t.label}
            </span>

            {active && (
              <motion.span
                layoutId="active-pill"
                className="
                  absolute -top-1
                  w-2 h-2 max-[360px]:w-1.5 max-[360px]:h-1.5
                  rounded-full bg-teal-500
                "
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
