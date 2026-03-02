import { motion } from "framer-motion";

export default function Footer() {
  return (
    <footer
      className="
        fixed inset-x-0 bottom-0 z-20
        border-t border-[var(--mm-border)]
        bg-white dark:bg-gray-950
        w-full
      "
      style={{
        paddingBottom: "var(--safe-bottom)",
        paddingLeft: "16px",
        paddingRight: "16px",
      }}
    >
      <div
        className="
          mx-auto w-full
          flex flex-col sm:flex-row
          sm:items-center sm:justify-between
          gap-2 sm:gap-4
          py-2
        "
      >
        {/* Left: Logo + Brand */}
        <div className="flex items-center gap-2 min-w-0">
          <img
            src="/ictbanner.jpg"
            alt="Mastermind Logo"
            className="h-6 w-6 object-contain shrink-0"
          />
          <span className="font-semibold text-base sm:text-lg truncate">
            Mastermind
          </span>
        </div>

        {/* Right: Contact */}
        <div className="flex items-center sm:justify-end">
          <motion.a
            whileTap={{ scale: 0.95 }}
            href="https://ictmastermind.com"
            target="_blank"
            rel="noopener noreferrer"
            className="
              bg-teal-500 hover:bg-teal-600
              text-white px-3 py-1.5
              rounded-lg text-xs font-medium
              transition-colors
              whitespace-nowrap
            "
          >
            Contact
          </motion.a>
        </div>
      </div>
    </footer>
  );
}
