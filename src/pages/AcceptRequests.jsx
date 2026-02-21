import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import axios from "axios";

/* =========================
   Small Reusable Spinner
========================= */
function Spinner({ className = "h-4 w-4 text-[var(--mm-teal)]" }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

/* =========================
   Stable ID Helpers
========================= */
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
  });
  return `req:${hashString(payload)}`;
}

/* =========================
   Component
========================= */
export default function AcceptRequests() {
  const [search, setSearch] = useState("");
  const [requests, setRequests] = useState([]);

  // Loading states
  const [loadingList, setLoadingList] = useState(false);
  const [actionLoading, setActionLoading] = useState(
    /** @type {Record<string, 'approve'|'reject'|undefined>} */ ({}),
  );

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoadingList(true);
      const res = await axios.get(
        "https://ugliest-hannie-ezaz-307892de.koyeb.app/api/requests",
      );
      setRequests(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load requests:", err);
      setRequests([]);
    } finally {
      setLoadingList(false);
    }
  };

  const setItemLoading = (id, type) =>
    setActionLoading((prev) => ({ ...prev, [id]: type }));
  const clearItemLoading = (id) =>
    setActionLoading((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

  // Approve
  const handleApprove = async (id) => {
    if (!id) return;
    setItemLoading(id, "approve");
    try {
      // Optional optimistic removal (uncomment if desired):
      // setRequests((prev) => prev.filter((r) => (r._id ?? stableIdFromRequest(r)) !== id));

      await axios.put(
        `https://ugliest-hannie-ezaz-307892de.koyeb.app/api/requests/approve/${id}`,
      );
      await fetchRequests();
    } catch (err) {
      console.error("Approve failed:", err);
    } finally {
      clearItemLoading(id);
    }
  };

  // Reject
  const handleReject = async (id) => {
    if (!id) return;
    setItemLoading(id, "reject");
    try {
      // Optional optimistic removal (uncomment if desired):
      // setRequests((prev) => prev.filter((r) => (r._id ?? stableIdFromRequest(r)) !== id));

      await axios.put(
        `https://ugliest-hannie-ezaz-307892de.koyeb.app/api/requests/reject/${id}`,
      );
      await fetchRequests();
    } catch (err) {
      console.error("Reject failed:", err);
    } finally {
      clearItemLoading(id);
    }
  };

  // Filter memo
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
    <section className="space-y-6" aria-busy={loadingList}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl lg:text-2xl font-semibold flex items-center gap-2">
          Accept Requests
          {loadingList && <Spinner />}
        </h2>

        <button
          onClick={fetchRequests}
          disabled={loadingList}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-60"
        >
          {loadingList ? (
            <>
              <Spinner className="h-4 w-4 text-inherit" />
              Refreshing...
            </>
          ) : (
            <>↻ Refresh</>
          )}
        </button>
      </div>

      {/* Search */}
      <div className="max-w-md">
        <input
          type="text"
          placeholder="Search by name or Transaction ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={loadingList}
          className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mm-teal)] disabled:opacity-60"
        />
      </div>

      {/* Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loadingList && requests.length === 0 ? (
          <div className="col-span-full flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <Spinner />
            Loading requests...
          </div>
        ) : filtered.length > 0 ? (
          filtered.map((req) => {
            const key = stableIdFromRequest(req);
            const idForActions = req?._id ?? req?.id ?? key;
            const isApproving = actionLoading[idForActions] === "approve";
            const isRejecting = actionLoading[idForActions] === "reject";

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
                    onClick={() => handleApprove(idForActions)}
                    disabled={isApproving || isRejecting}
                    className="flex-1 py-2 text-sm rounded-xl bg-[var(--mm-teal)] text-white hover:opacity-90 transition inline-flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {isApproving ? (
                      <>
                        <Spinner className="h-4 w-4 text-white" />
                        Accepting...
                      </>
                    ) : (
                      "Accept"
                    )}
                  </button>

                  <button
                    onClick={() => handleReject(idForActions)}
                    disabled={isApproving || isRejecting}
                    className="flex-1 py-2 text-sm rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition inline-flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {isRejecting ? (
                      <>
                        <Spinner className="h-4 w-4" />
                        Rejecting...
                      </>
                    ) : (
                      "Reject"
                    )}
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
