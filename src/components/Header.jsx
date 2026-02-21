import { useEffect, useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import axios from "axios";
import ValidationModal from "./ValidationModal";

export default function Header({
  title,
  onOpenAuth,
  onOpenRegister,
  onGoAnnouncements,
}) {
  const auth = getAuth();

  const [firebaseUser, setFirebaseUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);

  // 🔔 unread announcement count
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingCount, setLoadingCount] = useState(false);

  const [showModal, setShowModal] = useState(false);

  const API_BASE = useMemo(
    () =>
      import.meta.env.VITE_API_URL ||
      "https://ugliest-hannie-ezaz-307892de.koyeb.app",
    [],
  );

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => (mountedRef.current = false);
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
        let headers = {};
        try {
          const token = await currentUser.getIdToken();
          if (token) headers.Authorization = `Bearer ${token}`;
        } catch {}

        const res = await axios.get(
          `${API_BASE}/api/users/${currentUser.uid}`,
          { headers, timeout: 12000 },
        );
        if (mountedRef.current) {
          setDbUser(res.data || null);
        }
      } catch (err) {
        console.error("Failed to fetch DB user:", err);
        if (mountedRef.current) setDbUser(null);
      }
    });

    return () => unsubscribe();
  }, [auth, API_BASE]);

  // 🔔 Fetch unread announcements (from last 24 hours)
  useEffect(() => {
    const fetchUnread = async () => {
      if (!firebaseUser) {
        setUnreadCount(0);
        return;
      }

      const afterIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

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
        if (mountedRef.current) setUnreadCount(0);
      } finally {
        if (mountedRef.current) setLoadingCount(false);
      }
    };

    fetchUnread();
  }, [firebaseUser, API_BASE]);

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

  // 🔔 Bell click — now just reset badge locally + navigate
  const handleClickBell = () => {
    setUnreadCount(0); // UI fast response
    onGoAnnouncements?.();
  };

  return (
    <>
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:bg-gray-950/80 border-b border-gray-200 dark:border-gray-800">
        <div className="mx-auto w-full max-w-7xl px-3 sm:px-4 py-2.5 sm:py-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 justify-between">
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
                title={title}
              >
                {title}
              </motion.h1>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-none">
              {/* 🔔 ANNOUNCEMENTS */}
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

                {firebaseUser && !loadingCount && unreadCount > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] leading-[18px] text-center font-semibold shadow"
                    title={`${unreadCount} new`}
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </motion.button>

              {/* AUTH BUTTONS */}
              {!firebaseUser ? (
                <>
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
                  {!dbUser?.is_validated && !dbUser?.request_sent && (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      className="rounded-full bg-orange-500 text-white p-2 hover:bg-orange-600 md:px-3 md:py-1.5 md:text-xs"
                      onClick={() => setShowModal(true)}
                      aria-label="Get Subscribed"
                      title="Get Subscribed"
                    >
                      <span className="inline md:hidden">Get Subscribed</span>
                      <span className="hidden md:inline">Get Validated</span>
                    </motion.button>
                  )}

                  {!dbUser?.is_validated && dbUser?.request_sent && (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      className="rounded-full bg-teal-600 text-white p-2 cursor-not-allowed md:px-3 md:py-1.5 md:text-xs"
                      disabled
                      aria-label="Pending"
                      title="Pending"
                    >
                      Pending
                    </motion.button>
                  )}

                  {dbUser?.is_validated && (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      className="rounded-full bg-green-600 text-white p-2 cursor-default md:px-3 md:py-1.5 md:text-xs"
                      disabled
                      aria-label="Subscribed"
                      title="Subscribed"
                    >
                      Subscribed
                    </motion.button>
                  )}

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

      <ValidationModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => window.location.reload()}
      />
    </>
  );
}
