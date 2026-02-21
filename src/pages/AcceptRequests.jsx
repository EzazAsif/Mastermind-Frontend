import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import axios from "axios";

function hashString(s) {
  let h1 = 0xdeadbeef,
    h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = (h1 ^ (h1 >>> 16)) >>> 0;
  h2 = (h2 ^ (h2 >>> 16)) >>> 0;
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

function stableIdFromRequest(req) {
  // 1) Prefer server-provided IDs
  if (req?._id != null) return String(req._id);
  if (req?.id != null) return String(req.id);

  // 2) Deterministic fallback from essential fields
  const payload = JSON.stringify({
    transactionId: req?.transactionId ?? "",
    userId: req?.user?.uid ?? req?.userId ?? "",
    displayName: req?.user?.displayName ?? "",
    createdAt: req?.createdAt ?? "",
    // add anything else your backend guarantees for uniqueness
  });
  return `req:${hashString(payload)}`;
}

export default function AcceptRequests() {
  const [search, setSearch] = useState("");
  const [requests, setRequests] = useState([]);

  // Fetch real requests
  useEffect(() => {
    fetchRequests();
    // Optionally: return a cancel token if your API supports it to avoid state updates after unmount
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await axios.get(
        "https://ugliest-hannie-ezaz-307892de.koyeb.app/api/requests",
      );
      setRequests(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load requests:", err);
      setRequests([]);
    }
  };

  // Approve
  const handleApprove = async (id) => {
    try {
      await axios.put(
        `https://ugliest-hannie-ezaz-307892de.koyeb.app/api/requests/approve/${id}`,
      );
      fetchRequests();
    } catch (err) {
      console.error("Approve failed:", err);
    }
  };

  // Reject
  const handleReject = async (id) => {
    try {
      await axios.put(
        `https://ugliest-hannie-ezaz-307892de.koyeb.app/api/requests/reject/${id}`,
      );
      fetchRequests();
    } catch (err) {
      console.error("Reject failed:", err);
    }
  };

  // Filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return requests;

    return requests.filter((req) => {
      const name = (req?.user?.displayName || "").toLowerCase();
      const tx = (req?.transactionId || "").toLowerCase();
      return (name + " " + tx).includes(q);
    });
  }, [search, requests]);

  return (
    <section className="space-y-6">
      <h2 className="text-xl lg:text-2xl font-semibold">Accept Requests</h2>

      {/* Search */}
      <div className="max-w-md">
        <input
          type="text"
          placeholder="Search by name or Transaction ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mm-teal)]"
        />
      </div>

      {/* Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length > 0 ? (
          filtered.map((req) => {
            const key = stableIdFromRequest(req);
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 shadow-soft hover:shadow-lg transition"
              >
                <div className="space-y-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    👤 User Name
                  </p>
                  <h3 className="font-semibold text-base">
                    {req?.user?.displayName || "No Name"}
                  </h3>

                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                    💳 Transaction ID
                  </p>
                  <p className="text-sm font-medium text-[var(--mm-teal)] break-all">
                    {req?.transactionId || "—"}
                  </p>
                </div>

                <div className="flex gap-3 mt-5">
                  <button
                    onClick={() => handleApprove(req?._id ?? key)}
                    className="flex-1 py-2 text-sm rounded-xl bg-[var(--mm-teal)] text-white hover:opacity-90 transition"
                  >
                    Accept
                  </button>

                  <button
                    onClick={() => handleReject(req?._id ?? key)}
                    className="flex-1 py-2 text-sm rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                  >
                    Reject
                  </button>
                </div>
              </motion.div>
            );
          })
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No matching requests found.
          </p>
        )}
      </div>
    </section>
  );
}
