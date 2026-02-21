import { useEffect, useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import axios from "axios";
import ValidationModal from "./ValidationModal";

function toIsoOrFallback(input, fallbackDate = new Date(0)) {
  try {
    if (!input) return fallbackDate.toISOString();

    // Firestore Timestamp object (v9 admin/web): has toDate()
    if (typeof input === "object" && input !== null) {
      if (typeof input.toDate === "function") {
        const d = input.toDate();
        return isNaN(d?.getTime())
          ? fallbackDate.toISOString()
          : d.toISOString();
      }
      // Serialized Timestamp coming via REST/axios: { seconds, nanoseconds }
      if (typeof input.seconds === "number") {
        const d = new Date(input.seconds * 1000);
        return isNaN(d.getTime())
          ? fallbackDate.toISOString()
          : d.toISOString();
      }
    }

    // String or Date
    const d = new Date(input);
    return isNaN(d.getTime()) ? fallbackDate.toISOString() : d.toISOString();
  } catch {
    return fallbackDate.toISOString();
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
  const [dbUser, setDbUser] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // 🔔 unread announcement count
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingCount, setLoadingCount] = useState(false);

  const API_BASE = useMemo(
    () => "https://ugliest-hannie-ezaz-307892de.koyeb.app",
    [],
  );
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Listen to Firebase auth state and load DB user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setFirebaseUser(currentUser);

      if (!currentUser) {
        setDbUser(null);
        setUnreadCount(0);
        return;
      }

      try {
        const res = await axios.get(`${API_BASE}/api/users/${currentUser.uid}`);
        if (mountedRef.current) {
          setDbUser(res.data || null);
        }
      } catch (err) {
        console.error("Failed to fetch DB user:", err);
        if (mountedRef.current) {
          setDbUser(null);
        }
      }
    });

    return () => unsubscribe();
  }, [auth, API_BASE]);

  // Fetch unread announcement count once we have dbUser
  useEffect(() => {
    const fetchUnread = async () => {
      if (!dbUser) {
        setUnreadCount(0);
        return;
      }

      // Safely derive ISO `after` from Firestore Timestamp/string/Date
      const afterIso = toIsoOrFallback(dbUser.lastNotified, new Date(0));

      setLoadingCount(true);
      try {
        const { data } = await axios.get(
          `${API_BASE}/api/announcements/count`,
          {
            params: { after: afterIso },
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

    fetchUnread();
  }, [dbUser, API_BASE]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setFirebaseUser(null);
      setDbUser(null);
      setUnreadCount(0);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // When user clicks the bell:
  // 1) Update lastNotified to "now" (if logged in)
  // 2) Reset the badge count
  // 3) Navigate to announcements (parent handler)
  const handleClickBell = async () => {
    try {
      if (firebaseUser) {
        await axios.put(
          `${API_BASE}/api/users/${firebaseUser.uid}/last-notified`,
          {
            // Omit body → server uses its serverTimestamp,
            // or you could pass: lastNotified: new Date().toISOString()
          },
        );

        // Optimistically update state & badge
        setUnreadCount(0);
        setDbUser((prev) =>
          prev ? { ...prev, lastNotified: new Date().toISOString() } : prev,
        );
      }
    } catch (err) {
      console.error("Failed to update lastNotified:", err);
      // Even if this fails, still navigate; badge will update on next render/fetch
    } finally {
      onGoAnnouncements?.();
    }
  };

  return (
    <>
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:bg-gray-950/80 border-b border-gray-200 dark:border-gray-800">
        <div className="mx-auto max-w-md md:max-w-lg lg:max-w-5xl xl:max-w-7xl px-4 py-3 flex items-center justify-between">
          {/* Logo + Title */}
          <div className="flex items-center gap-3">
            <motion.img
              src="/mastermind-logo.png"
              alt="Mastermind logo"
              className="h-12 w-12 shrink-0"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
            />

            <motion.h1
              className="text-xl md:text-2xl lg:text-3xl font-semibold tracking-tight"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {title}
            </motion.h1>
          </div>

          {/* Right Side Buttons */}
          <div className="flex items-center gap-2">
            {/* 🔔 Bell (Announcements) */}
            <motion.button
              type="button"
              aria-label="Announcements"
              title="Announcements"
              whileTap={{ scale: 0.97 }}
              onClick={handleClickBell}
              className="relative rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {/* Inline SVG bell icon */}
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

              {/* 🔴 Badge (hidden when 0 or loading) */}
              {firebaseUser && !loadingCount && unreadCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] leading-[18px] text-center font-semibold shadow"
                  title={`${unreadCount} new`}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </motion.button>

            {/* Not Logged In */}
            {!firebaseUser ? (
              <>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  className="rounded-full bg-teal-600 text-white px-3 py-1.5 text-xs hover:bg-teal-700"
                  onClick={onOpenAuth}
                >
                  Log in
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  className="rounded-full border border-teal-600 text-teal-700 dark:text-teal-300 px-3 py-1.5 text-xs hover:bg-teal-50 dark:hover:bg-teal-900/20"
                  onClick={onOpenRegister}
                >
                  Register
                </motion.button>
              </>
            ) : (
              <>
                {/* Validation Buttons */}
                {dbUser && !dbUser.is_validated && !dbUser.request_sent && (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    className="rounded-full bg-orange-500 text-white px-3 py-1.5 text-xs hover:bg-orange-600"
                    onClick={() => setShowModal(true)}
                  >
                    Get Validated
                  </motion.button>
                )}

                {dbUser && !dbUser.is_validated && dbUser.request_sent && (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    className="rounded-full bg-teal-600 text-white px-3 py-1.5 text-xs cursor-not-allowed"
                    disabled
                  >
                    Pending
                  </motion.button>
                )}

                {dbUser && dbUser.is_validated && (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    className="rounded-full bg-green-600 text-white px-3 py-1.5 text-xs cursor-default"
                    disabled
                  >
                    Subscribed
                  </motion.button>
                )}

                {/* Logout */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  className="rounded-full bg-red-600 text-white px-3 py-1.5 text-xs hover:bg-red-700"
                  onClick={handleLogout}
                >
                  Logout
                </motion.button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Validation Modal */}
      <ValidationModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => window.location.reload()}
      />
    </>
  );
}
