import Card from "../components/Card.jsx";
import Skeleton from "../components/Skeleton.jsx";
import { useEffect, useState } from "react";

export default function Home() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 700); // fake load
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Responsive grid scales up on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card
          title="Active Users"
          value="1,284"
          delta={6.3}
          icon={<span>👥</span>}
        />
        <Card
          title="Revenue"
          value="$8,420"
          delta={-1.2}
          icon={<span>💸</span>}
        />
        <Card
          title="Conversion"
          value="3.9%"
          delta={0.7}
          icon={<span>⚡</span>}
        />
      </div>

      <section className="rounded-xl2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 lg:p-6 shadow-soft">
        <h3 className="font-semibold text-base lg:text-lg">Recent Activity</h3>
        <ul className="mt-3 space-y-3 text-sm">
          {[
            ["New signup", "2m ago"],
            ["Payment received", "14m ago"],
            ["Task completed", "25m ago"],
          ].map(([t, s], i) => (
            <li key={i} className="flex items-center justify-between">
              <span>{t}</span>
              <span className="text-gray-500 dark:text-gray-400">{s}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
``;
