import { useEffect, useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import axios from "axios";
import ValidationModal from "./ValidationModal";

/** Safe ISO from any input (Timestamp/string/Date) with fallback */
function toIsoOrFallback(input, fallbackDate = new Date(0)) {
  try {
    if (!input) return fallbackDate.toISOString();

    if (typeof input === "object" && input !== null) {
      if (typeof input.toDate === "function") {
        const d = input.toDate();
        return isNaN(d?.getTime())
          ? fallbackDate.toISOString()
          : d.toISOString();
      }
      if (typeof input.seconds === "number") {
        const d = new Date(input.seconds * 1000);
        return isNaN(d.getTime())
          ? fallbackDate.toISOString()
          : d.toISOString();
      }
    }

    const d = new Date(input);
    return isNaN(d.getTime()) ? fallbackDate.toISOString() : d.toISOString();
  } catch {
    return fallbackDate.toISOString();
  }
}

const LS_LAST_VISITED_KEY = "announcements:lastVisitedAt";

function getLastVisitedIsoFromLS() {
  try {
    const raw = localStorage.getItem(LS_LAST_VISITED_KEY);
    if (!raw) return new Date(0).toISOString();
    const d = new Date(raw);
    return isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
  } catch {
    return new Date(0).toISOString();
  }
}

function setLastVisitedIsoToLS(iso) {
  try {
    localStorage.setItem(LS_LAST_VISITED_KEY, iso);
  } catch {
    // ignore
  }
}

export default function Header({
  title,
  onOpenAuth,
  onOpenRegister,
  onGoAnnouncements,
}) {
  const auth = getAuth();

  const [firebaseUser, setFirebaseUser] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // 🔔 unread announcement count (localStorage-based)
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingCount, setLoadingCount] = useState(false);

  const API_BASE = useMemo(
    () =>
      import.meta.env.VITE_API_URL ||
      "https://ugliest-hannie-ezaz-307892de.koyeb.app",
    [],
  );
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Listen to Firebase auth state (UI-only; announcements logic is localStorage)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setFirebaseUser(currentUser);
      // No DB user fetch; announcements last-read is local-only now
    });
    return () => unsubscribe();
  }, [auth]);

  // Fetch unread announcement count using localStorage "after"
  useEffect(() => {
    const fetchUnread = async () => {
      const afterIso = getLastVisitedIsoFromLS();

      setLoadingCount(true);
      try {
        const { data } = await axios.get(
          `${API_BASE}/api/announcements/count`,
          {
            params: { after: afterIso },
            timeout: 12000,
          },
        );
        if (mountedRef.current) {
          setUnreadCount(Number(data?.count || 0));
        }
      } catch (err) {
        console.error("Failed to fetch announcements count:", err);
        if (mountedRef.current) {
          setUnreadCount(0);
        }
      } finally {
        if (mountedRef.current) {
          setLoadingCount(false);
        }
      }
    };

    // Run on mount and whenever API_BASE changes
    fetchUnread();
  }, [API_BASE]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setFirebaseUser(null);
      // unreadCount remains local; no server interaction
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  /**
   * When user clicks the bell:
   * 1) Optimistically reset badge to 0
   * 2) Write "now" to localStorage as lastVisited
   * 3) Navigate to announcements
   */
  const handleClickBell = async () => {
    try {
      const nowIso = new Date().toISOString();
      setUnreadCount(0);
      setLastVisitedIsoToLS(nowIso);
    } catch (err) {
      // Even if storage fails, still navigate; count will refresh next time
      console.warn("Failed to persist lastVisitedAt:", err);
    } finally {
      onGoAnnouncements?.();
    }
  };

  return (
    <>
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:bg-gray-950/80 border-b border-gray-200 dark:border-gray-800">
        <div className="mx-auto w-full max-w-7xl px-3 sm:px-4 py-2.5 sm:py-3">
          {/* Row: allow wrapping */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 justify-between">
            {/* Left: Logo + Title (allow shrink/truncate) */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <motion.img
                src="/mastermind-logo.png"
                alt="Mastermind logo"
                className="h-9 w-9 sm:h-10 sm:w-10 md:h-12 md:w-12 shrink-0"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
              />
              <motion.h1
                className="text-base sm:text-lg md:text-2xl font-semibold tracking-tight truncate whitespace-nowrap"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                title={title} // shows full title on hover
              >
                {title}
              </motion.h1>
            </div>

            {/* Right: Actions (compact on small screens) */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-none">
              {/* 🔔 Bell (Announcements) */}
              <motion.button
                type="button"
                aria-label="Announcements"
                title="Announcements"
                whileTap={{ scale: 0.97 }}
                onClick={handleClickBell}
                className="relative rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-gray-700 dark:text-gray-200"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0m6 0H9"
                  />
                </svg>

                {!loadingCount && unreadCount > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] leading-[18px] text-center font-semibold shadow"
                    title={`${unreadCount} new`}
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </motion.button>

              {/* NOT LOGGED IN */}
              {!firebaseUser ? (
                <>
                  {/* Icon-only on xs, text on md+ */}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    className="rounded-full bg-teal-600 text-white p-2 hover:bg-teal-700 md:px-3 md:py-1.5 md:text-xs"
                    onClick={onOpenAuth}
                    aria-label="Log in"
                    title="Log in"
                  >
                    <span className="md:inline hidden">Log in</span>
                    <svg
                      className="h-5 w-5 md:hidden"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12H3m0 0l4-4m-4 4l4 4m6-10h3a2 2 0 012 2v12a2 2 0 01-2 2h-3"
                      />
                    </svg>
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    className="rounded-full border border-teal-600 text-teal-700 dark:text-teal-300 p-2 hover:bg-teal-50 dark:hover:bg-teal-900/20 md:px-3 md:py-1.5 md:text-xs"
                    onClick={onOpenRegister}
                    aria-label="Register"
                    title="Register"
                  >
                    <span className="md:inline hidden">Register</span>
                    <svg
                      className="h-5 w-5 md:hidden"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </motion.button>
                </>
              ) : (
                <>
                  {/* Validation Buttons — unchanged, relies on your existing dbUser logic elsewhere if needed */}
                  {/* If you no longer have dbUser here, you can disable these or wire them to your current UI state */}
                  {/* Logout */}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    className="rounded-full bg-red-600 text-white p-2 hover:bg-red-700 md:px-3 md:py-1.5 md:text-xs"
                    onClick={handleLogout}
                    aria-label="Logout"
                    title="Logout"
                  >
                    <span className="md:inline hidden">Logout</span>
                    <svg
                      className="h-5 w-5 md:hidden"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1"
                      />
                    </svg>
                  </motion.button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Validation Modal (kept as-is) */}
      <ValidationModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => window.location.reload()}
      />
    </>
  );
}
