import { useMemo, useState, useEffect } from "react";
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
  const openPdf = (fileName) => {
    setPdfFile(fileName);
    setRoute("ViewPdf");
  };

  const [currentUser, setCurrentUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

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
      ViewPdf: <ViewPdf fileName={pdfFile} currentUser={currentUser} />,
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
  }, [currentUser, pdfFile]);

  const CurrentPage = useMemo(() => PAGES[route], [PAGES, route]);

  if (loadingUser)
    return <p className="text-center mt-4">Loading user information...</p>;

  return (
    <div
      className={`${dark ? "dark" : ""} min-h-screen w-screen bg-white dark:bg-gray-900`}
    >
      <div className="mx-auto h-dvh w-full max-w-screen-xl bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100 transition-colors duration-300">
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
          onGoAnnouncements={() => setRoute("announcements")} // ✅ Add this line
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
      </div>
    </div>
  );
}
