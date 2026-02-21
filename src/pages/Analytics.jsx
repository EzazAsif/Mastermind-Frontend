// src/components/Analytics.jsx
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import { collection, getDocs, getFirestore } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function Analytics() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");

  useEffect(() => {
    let unsub = () => {};
    setLoading(true);

    unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setNote("You must sign in to view analytics.");
        setStats({
          totalUsers: 0,
          subscribed: 0,
          daily: 0,
          weekly: 0,
          monthly: 0,
        });
        setLoading(false);
        return;
      }

      try {
        // Optional: inspect claims for debugging
        const token = await user.getIdTokenResult();
        console.log("Claims:", token.claims);

        // 1) Users & subscribed from backend
        const usersRes = await axios.get(
          "https://ugliest-hannie-ezaz-307892de.koyeb.app/api/users",
          {
            // If your backend expects auth, include it:
            // headers: { Authorization: `Bearer ${await user.getIdToken()}` }
          },
        );
        const users = Array.isArray(usersRes.data) ? usersRes.data : [];
        const totalUsers = users.length;
        const subscribed = users.filter((u) => u.is_validated).length;

        // 2) Login history from Firestore (admin-only per rules)
        let daily = 0,
          weekly = 0,
          monthly = 0;
        try {
          const loginsSnap = await getDocs(
            collection(getFirestore(), "logins"),
          );
          const now = new Date();
          const oneDay = 1000 * 60 * 60 * 24;

          loginsSnap.forEach((doc) => {
            const data = doc.data();
            if (!data.lastLogin) return;

            let lastLogin;
            if (data.lastLogin?.toDate) lastLogin = data.lastLogin.toDate();
            else if (typeof data.lastLogin === "string")
              lastLogin = new Date(data.lastLogin);
            else if (data.lastLogin?.seconds)
              lastLogin = new Date(data.lastLogin.seconds * 1000);
            else return;

            const diff = now - lastLogin;
            if (diff <= oneDay) daily += 1;
            if (diff <= oneDay * 7) weekly += 1;
            if (diff <= oneDay * 30) monthly += 1;
          });
        } catch (err) {
          // Permission issue => probably not admin or rules not set yet
          console.error("Login collection read failed:", err);
          if (err.code === "permission-denied") {
            setNote(
              "Limited view: you don't have permission to read login analytics.",
            );
          } else {
            setNote("Login analytics unavailable at the moment.");
          }
          // Keep daily/weekly/monthly as 0 in this case
        }

        setStats({ totalUsers, subscribed, daily, weekly, monthly });
      } catch (err) {
        console.error("Failed to fetch stats:", err);
        setNote("Failed to fetch analytics.");
        setStats({
          totalUsers: 0,
          subscribed: 0,
          daily: 0,
          weekly: 0,
          monthly: 0,
        });
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  if (loading || !stats) return <p>Loading stats...</p>;

  const metrics = [
    {
      name: "Total Users",
      value: stats.totalUsers ?? 0,
      color: "bg-[var(--mm-orange)]",
    },
    {
      name: "Total Subscribed",
      value: stats.subscribed ?? 0,
      color: "bg-emerald-500",
    },
    { name: "Daily Active", value: stats.daily ?? 0, color: "bg-blue-500" },
    { name: "Weekly Active", value: stats.weekly ?? 0, color: "bg-purple-500" },
    { name: "Monthly Active", value: stats.monthly ?? 0, color: "bg-pink-500" },
  ];

  const maxValue = Math.max(...metrics.map((m) => m.value), 1);

  return (
    <section className="rounded-xl2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 lg:p-6 shadow-soft">
      <h3 className="font-semibold text-base lg:text-lg mb-4">
        User Activity Stats
      </h3>

      <div className="grid grid-cols-5 gap-4 items-end h-48">
        {metrics.map((metric, i) => {
          const heightPercent = (metric.value / maxValue) * 100;
          return (
            <div key={metric.name} className="flex flex-col items-center">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${heightPercent}%` }}
                transition={{
                  delay: i * 0.1,
                  type: "spring",
                  stiffness: 160,
                  damping: 18,
                }}
                className={`w-8 rounded-t-md origin-bottom ${metric.color}`}
              />
              <p className="mt-2 text-xs text-center dark:text-gray-300">
                {metric.name} <br /> {metric.value}
              </p>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        Daily/Weekly/Monthly counts are based on Firebase login history.
      </p>

      {note && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          {note}
        </p>
      )}
    </section>
  );
}
``;
