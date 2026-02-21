import { useState } from "react";

export default function Settings() {
  const [vibrate, setVibrate] = useState(true);

  return (
    <section className="rounded-xl2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 lg:p-6 shadow-soft space-y-4">
      <h3 className="font-semibold text-base lg:text-lg">Preferences</h3>

      <label className="flex items-center justify-between">
        <span>Haptic feedback</span>
        <input
          type="checkbox"
          checked={vibrate}
          onChange={() => setVibrate((v) => !v)}
          className="accent-teal h-5 w-5"
        />
      </label>

      <button className="w-full rounded-xl bg-[var(--mm-teal)] text-white py-3 font-medium shadow-soft hover:bg-[var(--mm-teal-dark)] active:translate-y-px transition">
        Save Changes
      </button>
    </section>
  );
}
