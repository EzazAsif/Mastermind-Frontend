import { useMemo, useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";

// Pages
import Home from "./pages/Home.jsx";
import Analytics from "./pages/Analytics.jsx";
import Announcements from "./pages/Announcements.jsx";
import Settings from "./pages/Settings.jsx";
import Student from "./pages/Student.jsx";
import UploadPdf from "./pages/UploadPdf.jsx";
import AcceptRequests from "./pages/AcceptRequests.jsx";
import Notes from "./pages/Notes.jsx";
import ViewPdf from "./pages/ViewPdf.jsx";
import Chapters from "./pages/Chapters.jsx";
import TakeExam from "./pages/TakeExam.jsx";
import AddAnnouncement from "./pages/AddAnnouncement.jsx";
import FirstTimeGuide from "./components/FirstTimeGuide.jsx";

// Components
import Header from "./components/Header.jsx";
import BottomNav from "./components/BottomNav.jsx";
import Sidebar from "./components/SideBar.jsx";
import Footer from "./components/Footer.jsx";
import AuthModal from "./components/AuthModal.jsx";

// Firebase
import { auth } from "./lib/firebase";

export default function App() {
  const [route, setRoute] = useState("student");
  const [dark, setDark] = useState(false);

  const [authOpen, setAuthOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);

  const [pdfFile, setPdfFile] = useState(null);

  // ✅ CHANGED: useCallback + keep same behavior
  const openPdf = useCallback((fileName) => {
    setPdfFile(fileName);
    setRoute("ViewPdf");
  }, []);

  // ✅ NEW: back from PDF -> Notes
  const closePdfToNotes = useCallback(() => {
    setPdfFile(null);
    setRoute("Notes");
  }, []);

  const [currentUser, setCurrentUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // NEW: Gating modal state
  const [showGateModal, setShowGateModal] = useState(false);

  // ------------------------- Fetch Current User -------------------------
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setCurrentUser(null);
        setLoadingUser(false);
        return;
      }

      try {
        const res = await fetch(
          `https://ugliest-hannie-ezaz-307892de.koyeb.app/api/users/${user.uid}`,
        );
        if (!res.ok) throw new Error("Failed to fetch user from server");
        const data = await res.json();
        setCurrentUser(data);
      } catch (err) {
        console.error("Error fetching current user:", err);
        setCurrentUser(null);
      } finally {
        setLoadingUser(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // ------------------------- Chance-based modal on load -------------------------
  useEffect(() => {
    // Run only after we've finished loading the user
    if (!loadingUser) {
      const notLoggedIn = !currentUser;
      const notValidated = !currentUser?.is_validated;

      if ((notLoggedIn || notValidated) && Math.random() < 0.33) {
        setShowGateModal(true);
      }
    }
  }, [loadingUser, currentUser]);

  // ✅ NEW: safety - if route is ViewPdf but pdfFile missing, go to Notes
  useEffect(() => {
    if (route === "ViewPdf" && !pdfFile) {
      setRoute("Notes");
    }
  }, [route, pdfFile]);

  // ✅ NEW: fullscreen mode flag for PDF
  const isPdfRoute = route === "ViewPdf";

  // ------------------------- Pages Map -------------------------
  const PAGES = useMemo(() => {
    return {
      student: (
        <Student
          currentUser={currentUser}
          setRoute={setRoute}
          openPdf={openPdf}
          onOpenAuth={() => {
            setAuthOpen(true);
            setRegisterOpen(false);
          }}
        />
      ),
      home: <Home />,
      analytics: currentUser?.is_Admin ? (
        <Analytics />
      ) : (
        <Student
          currentUser={currentUser}
          setRoute={setRoute}
          openPdf={openPdf}
          onOpenAuth={() => setAuthOpen(true)}
        />
      ),
      announcements: <Announcements uid={currentUser?.uid} />,
      settings: <Settings />,
      uploadPdf: currentUser?.is_Admin ? (
        <UploadPdf />
      ) : (
        <Student
          currentUser={currentUser}
          setRoute={setRoute}
          openPdf={openPdf}
          onOpenAuth={() => setAuthOpen(true)}
        />
      ),
      acceptRequest: currentUser?.is_Admin ? (
        <AcceptRequests />
      ) : (
        <Student
          currentUser={currentUser}
          setRoute={setRoute}
          openPdf={openPdf}
          onOpenAuth={() => setAuthOpen(true)}
        />
      ),
      Notes: <Notes openPdf={openPdf} currentUser={currentUser} />,

      // ✅ CHANGED: pass onBack so back goes to Notes
      ViewPdf: (
        <ViewPdf
          fileName={pdfFile}
          currentUser={currentUser}
          onBack={closePdfToNotes}
        />
      ),

      ManageChapters: currentUser?.is_Admin ? (
        <Chapters />
      ) : (
        <Student
          currentUser={currentUser}
          setRoute={setRoute}
          openPdf={openPdf}
          onOpenAuth={() => setAuthOpen(true)}
        />
      ),
      takeExam: currentUser?.is_validated ? (
        <TakeExam currentUser={currentUser} />
      ) : (
        <Student
          currentUser={currentUser}
          setRoute={setRoute}
          openPdf={openPdf}
          onOpenAuth={() => setAuthOpen(true)}
        />
      ),
      addAnnouncement: currentUser?.is_Admin ? (
        <AddAnnouncement />
      ) : (
        <Student
          currentUser={currentUser}
          setRoute={setRoute}
          openPdf={openPdf}
          onOpenAuth={() => setAuthOpen(true)}
        />
      ),
    };
  }, [currentUser, pdfFile, openPdf, closePdfToNotes]);

  const CurrentPage = useMemo(() => PAGES[route], [PAGES, route]);

  if (loadingUser)
    return <p className="text-center mt-4">Loading user information...</p>;

  return (
    <div
      className={`${dark ? "dark" : ""} min-h-screen w-screen bg-white dark:bg-gray-900`}
    >
      <div className="mx-auto h-dvh w-full max-w-screen-xl bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100 transition-colors duration-300">
        {/* ✅ NEW: If viewing PDF, render only PDF page (no header/footer/bottom nav spacing) */}
        {isPdfRoute ? (
          CurrentPage
        ) : (
          <>
            <div style={{ paddingTop: "var(--safe-top)" }} />
            {/* Header */}
            <Header
              title="ICT Mastermind"
              onOpenAuth={() => {
                setAuthOpen(true);
                setRegisterOpen(false);
              }}
              onOpenRegister={() => {
                setRegisterOpen(true);
                setAuthOpen(false);
              }}
              onGoAnnouncements={() => setRoute("announcements")} // ✅
            />

            {/* Layout */}
            <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-6">
              {/* Sidebar (Desktop only) */}
              <aside className="hidden lg:block">
                <Sidebar route={route} onChange={setRoute} user={currentUser} />
              </aside>

              {/* Main Content */}
              <main
                className="px-4 lg:pb-6"
                style={{
                  paddingBottom:
                    "calc(var(--bottom-nav-h) + var(--footer-h) + var(--safe-bottom))",
                }}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={route}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ type: "spring", stiffness: 260, damping: 26 }}
                  >
                    {CurrentPage}
                  </motion.div>
                </AnimatePresence>
              </main>
            </div>
            <Footer />
            {/* Bottom Nav (Mobile only) */}
            <div className="lg:hidden">
              <BottomNav route={route} onChange={setRoute} user={currentUser} />
            </div>

            {/* Auth Modals */}
            <AuthModal
              open={authOpen}
              mode="login"
              onClose={() => setAuthOpen(false)}
            />
            <AuthModal
              open={registerOpen}
              mode="register"
              onClose={() => setRegisterOpen(false)}
            />

            {/* ---------------- Gate Modal (33% chance) ---------------- */}
            <AnimatePresence>
              {showGateModal && (
                <motion.div
                  className="fixed inset-0 z-50 flex items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  aria-modal="true"
                  role="dialog"
                  aria-labelledby="gate-modal-title"
                  aria-describedby="gate-modal-desc"
                >
                  {/* Backdrop */}
                  <div
                    className="absolute inset-0 bg-black/50"
                    onClick={() => setShowGateModal(false)}
                  />

                  {/* Modal Card */}
                  <motion.div
                    className="relative z-10 w-[92%] max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
                    initial={{ scale: 0.96, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.96, opacity: 0 }}
                  >
                    <h3
                      id="gate-modal-title"
                      className="text-lg font-semibold text-gray-900 dark:text-gray-100"
                    >
                      Unlock Full Access
                    </h3>
                    <p
                      id="gate-modal-desc"
                      className="mt-2 text-sm text-gray-600 dark:text-gray-300"
                    >
                      To get full content and take exams, please login and
                      subscribe.
                    </p>

                    <div className="mt-6 flex items-center justify-end gap-3">
                      <button
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                        onClick={() => setShowGateModal(false)}
                      >
                        Cancel
                      </button>
                      <button
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        onClick={() => {
                          setShowGateModal(false);
                          // Open login (or switch to register if you prefer)
                          setAuthOpen(true);
                          setRegisterOpen(false);
                          // If you have a dedicated subscription flow, navigate or open it here.
                        }}
                      >
                        Login & Subscribe
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
            {/* --------------------------------------------------------- */}
            {/* Onboarding Tour */}
            <FirstTimeGuide />
          </>
        )}
      </div>
    </div>
  );
}
