// src/components/StudentWelcome.jsx

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getAuth, onAuthStateChanged, updateProfile } from "firebase/auth";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

/** Official Bangladesh exam boards (SSC & HSC) */
export const BD_EXAM_BOARDS = [
  "Dhaka",
  "Chattogram",
  "Cumilla",
  "Rajshahi",
  "Jashore",
  "Sylhet",
  "Barishal",
  "Dinajpur",
  "Mymensingh",
  "Madrasah",
  "Technical",
];

/* ------------------------------------------------------------------
   useAsyncImage
   - Asynchronously loads an image and resolves only after it's decoded.
   - Returns { loadedUrl, status } where status = 'idle'|'loading'|'loaded'|'error'|'empty'
------------------------------------------------------------------- */
function useAsyncImage(url, version) {
  const [state, setState] = useState({
    loadedUrl: "",
    status: "idle", // 'idle' | 'loading' | 'loaded' | 'error' | 'empty'
  });

  useEffect(() => {
    let cancelled = false;

    // Empty URL → show fallback
    if (!url) {
      setState({ loadedUrl: "", status: "empty" });
      return () => {
        cancelled = true;
      };
    }

    // Cache-bust to avoid stale images after updates
    const cacheBusted = version
      ? `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(
          String(version),
        )}`
      : url;

    setState((s) => ({ ...s, status: "loading" }));

    (async () => {
      try {
        const img = new Image();
        img.decoding = "async";
        img.referrerPolicy = "no-referrer";
        img.src = cacheBusted;

        if (img.decode) {
          // Modern browsers support HTMLImageElement.decode()
          await img.decode();
        } else {
          // Fallback for older browsers
          await new Promise((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = (e) => reject(e);
          });
        }

        if (!cancelled) {
          setState({ loadedUrl: cacheBusted, status: "loaded" });
        }
      } catch (e) {
        if (!cancelled) {
          setState({ loadedUrl: "", status: "error" });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, version]);

  return state;
}

/* -----------------------------------------
   Avatar (async loader + cache-busting + fallback)
------------------------------------------ */
function Avatar({ url, initial, size = 40, version }) {
  const { loadedUrl, status } = useAsyncImage(url, version);

  if (status === "loaded" && loadedUrl) {
    return (
      <img
        src={loadedUrl}
        alt="avatar"
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
        onError={(e) => {
          // Final UI fallback if a later error occurs (rare)
          e.currentTarget.style.display = "none";
        }}
      />
    );
  }

  // While loading or on error/empty, show initials
  return (
    <div
      className="rounded-full bg-[var(--mm-teal)] text-white grid place-items-center font-semibold"
      style={{ width: size, height: size }}
      aria-label="avatar-fallback"
      title={
        status === "loading"
          ? "Loading photo…"
          : status === "error"
            ? "Photo failed to load"
            : "No photo"
      }
    >
      {initial}
    </div>
  );
}

/* -----------------------------------------
   StudentWelcome
------------------------------------------ */
export default function StudentWelcome({ student, onOpenAuth }) {
  const auth = getAuth();
  const [currentUser, setCurrentUser] = useState(null);

  // Profile modal open/close
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Backend user (Board/ExamYEar)
  const [dbUser, setDbUser] = useState(null);
  const [loadingDb, setLoadingDb] = useState(false);

  // Used to gently bust cache after successful profile save (avatar change)
  const [avatarVersion, setAvatarVersion] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        try {
          setLoadingDb(true);
          const baseUrl =
            import.meta.env?.VITE_API_URL ||
            "https://ugliest-hannie-ezaz-307892de.koyeb.app";
          const res = await fetch(`${baseUrl}/api/users/${user.uid}`);
          if (res.ok) {
            const data = await res.json();
            setDbUser(data);
          } else {
            setDbUser(null);
          }
        } catch (e) {
          console.error("Failed to fetch user profile:", e);
          setDbUser(null);
        } finally {
          setLoadingDb(false);
        }
      } else {
        setDbUser(null);
      }
    });

    return () => unsubscribe();
  }, [auth]);

  const displayName = currentUser
    ? currentUser.displayName || currentUser.email
    : "Not logged in";
  const avatarInitial = (displayName?.trim?.()[0] || "?").toUpperCase();

  // Prefer a backend timestamp if you have one (e.g., updatedAt), else use lastSignInTime.
  // We additionally bump a local avatarVersion to force a refresh after saving.
  const versionKey =
    dbUser?.updatedAt ||
    currentUser?.metadata?.lastSignInTime ||
    "" + avatarVersion;

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl2 bg-gradient-to-br from-[var(--mm-teal)/10] to-[var(--mm-teal)/5] dark:from-[var(--mm-teal)/20] dark:to-transparent border border-gray-200 dark:border-gray-800 p-4 shadow-soft"
      >
        <div className="flex items-center gap-3">
          <Avatar
            url={currentUser?.photoURL || ""}
            initial={avatarInitial}
            size={40}
            version={versionKey}
          />

          <div className="flex-1">
            <p className="text-xs text-gray-600 dark:text-gray-300">
              {currentUser ? "Welcome back" : "Guest Mode"}
            </p>

            <h2 className="text-lg font-semibold">{displayName}</h2>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              {currentUser ? student?.grade : ""}
              {currentUser && dbUser ? (
                <>
                  {student?.grade ? " • " : ""}
                  {dbUser?.Board && dbUser.Board !== "none"
                    ? dbUser.Board
                    : "Board: —"}
                  {" • "}
                  {dbUser?.ExamYEar ? dbUser.ExamYEar : "Year: —"}
                </>
              ) : null}
            </p>
          </div>

          <button
            className="rounded-full border border-gray-200 dark:border-gray-800 px-3 py-1.5 text-xs font-medium"
            onClick={() => {
              if (currentUser) {
                setShowProfileModal(true);
              } else {
                onOpenAuth?.();
              }
            }}
          >
            {currentUser ? "Profile" : "Login"}
          </button>
        </div>
      </motion.section>

      {currentUser && (
        <ProfileModal
          open={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          firebaseUser={currentUser}
          dbUser={dbUser}
          loadingDb={loadingDb}
          onSaved={async (updatedDbUser, photoChanged) => {
            // Update backend user in UI
            setDbUser(updatedDbUser);

            // Force-refresh the Firebase Auth user (to pick updated photoURL/name)
            await currentUser.reload?.();
            setCurrentUser(getAuth().currentUser);

            // If photo changed, bump local version to invalidate image cache
            if (photoChanged) {
              setAvatarVersion((v) => v + 1);
            }
          }}
        />
      )}
    </>
  );
}

/* ============================================================
   Inline Profile Modal
   - Edits Firebase displayName
   - Edits backend Board + ExamYEar
   - (Optional) Uploads a new avatar to Firebase Storage and updates photoURL
============================================================ */
function ProfileModal({
  open,
  onClose,
  firebaseUser,
  dbUser,
  loadingDb,
  onSaved,
}) {
  const [name, setName] = useState(firebaseUser?.displayName || "");
  const [board, setBoard] = useState(dbUser?.Board || "Dhaka"); // default "Dhaka"
  const [year, setYear] = useState(dbUser?.ExamYEar || "");

  const [avatarFile, setAvatarFile] = useState(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(firebaseUser?.displayName || "");
      setBoard(dbUser?.Board || "Dhaka");
      setYear(dbUser?.ExamYEar || "");
      setAvatarFile(null);
      setError("");
    }
  }, [open, firebaseUser, dbUser]);

  if (!open) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    let photoChanged = false;

    try {
      // 0) Base URL for backend
      const baseUrl =
        import.meta.env?.VITE_API_URL ||
        "https://ugliest-hannie-ezaz-307892de.koyeb.app";

      // 1) If the user selected a new avatar, upload to Firebase Storage and update photoURL
      if (avatarFile) {
        const storage = getStorage(); // assumes Firebase app is initialized in your app entry
        const ext = avatarFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const objectPath = `avatars/${firebaseUser.uid}/avatar.${ext}`;
        const fileRef = storageRef(storage, objectPath);

        // upload and get public URL
        await uploadBytes(fileRef, avatarFile);
        const publicUrl = await getDownloadURL(fileRef);

        // update Firebase auth profile photoURL
        await updateProfile(firebaseUser, { photoURL: publicUrl });
        photoChanged = true;
      }

      // 2) Update displayName if changed
      if (name && name !== firebaseUser.displayName) {
        await updateProfile(firebaseUser, { displayName: name });
      }

      // 3) Update backend (Board + ExamYEar)
      const payload = {
        Board:
          typeof board === "string" && board.trim() ? board.trim() : "none",
        // Keep schema key EXACT if your model uses "ExamYEar"
        ExamYEar: Number(year) || 0,
      };

      const currentYear = new Date().getFullYear();
      if (
        payload.ExamYEar !== 0 &&
        (payload.ExamYEar < 1980 || payload.ExamYEar > currentYear + 1)
      ) {
        throw new Error(
          `Invalid year. Use 1980–${currentYear + 1}, or leave blank.`,
        );
      }

      const res = await fetch(`${baseUrl}/api/users/${firebaseUser.uid}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          // Optional: include ID token if your backend verifies it
          // Authorization: `Bearer ${await firebaseUser.getIdToken()}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let message = "Failed to update profile";
        try {
          const data = await res.json();
          if (data?.message) message = data.message;
        } catch {}
        throw new Error(message);
      }

      const updatedDbUser = await res.json();

      // done
      onSaved?.(updatedDbUser, photoChanged);
      onClose?.();
    } catch (err) {
      console.error("PROFILE SAVE ERROR:", err);
      setError(err.message || "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Edit Profile</h3>
          <button
            className="text-sm text-gray-500 hover:text-gray-800 dark:text-gray-300"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {loadingDb ? (
          <p className="text-sm text-gray-500">Loading profile…</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-3">
            {error && (
              <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                {error}
              </div>
            )}

            {/* Name */}
            <div>
              <label className="mb-1 block text-sm font-medium">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-gray-700 dark:bg-gray-800"
                placeholder="Your name"
              />
              <p className="mt-1 text-xs text-gray-500">
                Updates your Firebase profile name.
              </p>
            </div>

            {/* Board */}
            <div>
              <label className="mb-1 block text-sm font-medium">Board</label>
              <select
                value={board}
                onChange={(e) => setBoard(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-gray-700 dark:bg-gray-800"
              >
                {BD_EXAM_BOARDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
                <option value="none">Other / Not listed</option>
              </select>
            </div>

            {/* Exam Year */}
            <div>
              <label className="mb-1 block text-sm font-medium">
                Exam Year
              </label>
              <input
                type="number"
                inputMode="numeric"
                min="1980"
                max={new Date().getFullYear() + 1}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-gray-700 dark:bg-gray-800"
                placeholder={`${new Date().getFullYear()}`}
              />
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
