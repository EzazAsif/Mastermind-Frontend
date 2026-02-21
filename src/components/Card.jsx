import { motion } from "framer-motion";

export default function Card({ title, value, delta, icon }) {
  const positive = delta >= 0;
  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="rounded-xl2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 shadow-soft"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl lg:text-3xl font-semibold mt-1">{value}</p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
          {icon}
        </div>
      </div>
      <p
        className={`mt-3 text-xs font-medium ${positive ? "text-emerald-600" : "text-rose-600"}`}
      >
        {positive ? "▲" : "▼"} {Math.abs(delta)}%
      </p>
    </motion.div>
  );
}
