// src/components/StudentWelcome.jsx
import { useEffect, useMemo, useState } from "react";
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
    status: "idle",
  });

  useEffect(() => {
    let cancelled = false;

    if (!url) {
      setState({ loadedUrl: "", status: "empty" });
      return () => {
        cancelled = true;
      };
    }

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
          await img.decode();
        } else {
          await new Promise((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = (e) => reject(e);
          });
        }

        if (!cancelled) setState({ loadedUrl: cacheBusted, status: "loaded" });
      } catch {
        if (!cancelled) setState({ loadedUrl: "", status: "error" });
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
          e.currentTarget.style.display = "none";
        }}
      />
    );
  }

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
   Helpers
------------------------------------------ */
function isProfileIncomplete(u) {
  if (!u) return false;
  const boardMissing =
    !u.Board || String(u.Board).trim() === "" || u.Board === "none";
  const yearMissing = !u.ExamYEar || Number(u.ExamYEar) === 0;
  const phoneMissing =
    !u.phone ||
    String(u.phone).trim() === "" ||
    String(u.phone).toLowerCase() === "none";
  return boardMissing || yearMissing || phoneMissing;
}

/** Normalize + validate BD phone */
function normalizeBdPhone(input) {
  const raw = String(input || "").trim();
  if (!raw) return { ok: true, value: "none" };

  let p = raw.replace(/[^\d+]/g, "");
  if (p.startsWith("8801") && !p.startsWith("+")) p = "+" + p;
  if (p.startsWith("01")) p = "+88" + p;

  // allow "none"
  if (p.toLowerCase() === "none") return { ok: true, value: "none" };

  const ok = /^\+8801\d{9}$/.test(p);
  if (!ok) {
    return {
      ok: false,
      value: p,
      message: "Invalid phone. Use 01XXXXXXXXX or +8801XXXXXXXXX.",
    };
  }
  return { ok: true, value: p };
}

/* -----------------------------------------
   StudentWelcome
------------------------------------------ */
export default function StudentWelcome({ student, onOpenAuth }) {
  const auth = getAuth();

  const [currentUser, setCurrentUser] = useState(null);

  // Backend user (Board/ExamYEar/phone)
  const [dbUser, setDbUser] = useState(null);
  const [loadingDb, setLoadingDb] = useState(false);

  // Profile modal open/close
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Prevent modal reopening loop after user closes it once in this session
  const [autoPrompted, setAutoPrompted] = useState(false);

  // Used to gently bust cache after successful profile save (avatar change)
  const [avatarVersion, setAvatarVersion] = useState(0);

  const baseUrl = useMemo(
    () =>
      import.meta.env?.VITE_API_URL ||
      "https://ugliest-hannie-ezaz-307892de.koyeb.app",
    [],
  );

  // Fetch firebase user + backend user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      // reset prompt flag on logout
      if (!user) {
        setDbUser(null);
        setAutoPrompted(false);
        setShowProfileModal(false);
        return;
      }

      try {
        setLoadingDb(true);
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
    });

    return () => unsubscribe();
  }, [auth, baseUrl]);

  // ✅ AUTO-OPEN the SAME ProfileModal if missing Board/Year/Phone (logged-in only)
  useEffect(() => {
    if (!currentUser || !dbUser) return;
    if (autoPrompted) return;

    if (isProfileIncomplete(dbUser)) {
      setShowProfileModal(true);
    }

    setAutoPrompted(true);
  }, [currentUser, dbUser, autoPrompted]);

  const displayName = currentUser
    ? currentUser.displayName || currentUser.email
    : "Not logged in";
  const avatarInitial = (displayName?.trim?.()[0] || "?").toUpperCase();

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
                  {" • "}
                  {dbUser?.phone && dbUser.phone !== "none"
                    ? dbUser.phone
                    : "Phone: —"}
                </>
              ) : null}
            </p>
          </div>

          <button
            className="rounded-full border border-gray-200 dark:border-gray-800 px-3 py-1.5 text-xs font-medium"
            onClick={() => {
              if (currentUser) setShowProfileModal(true);
              else onOpenAuth?.();
            }}
          >
            {currentUser ? "Profile" : "Login"}
          </button>
        </div>
      </motion.section>

      {/* Inline Update Modal */}
      {currentUser && (
        <ProfileModal
          open={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          firebaseUser={currentUser}
          dbUser={dbUser}
          loadingDb={loadingDb}
          baseUrl={baseUrl}
          onSaved={async (updatedDbUser, photoChanged) => {
            setDbUser(updatedDbUser);

            await currentUser.reload?.();
            setCurrentUser(getAuth().currentUser);

            if (photoChanged) setAvatarVersion((v) => v + 1);
          }}
        />
      )}
    </>
  );
}

/* ============================================================
   ProfileModal
   - Edits Firebase displayName
   - Edits backend Board + ExamYEar + phone
   - (Optional) Uploads a new avatar to Firebase Storage and updates photoURL
============================================================ */
function ProfileModal({
  open,
  onClose,
  firebaseUser,
  dbUser,
  loadingDb,
  onSaved,
  baseUrl,
}) {
  const [name, setName] = useState(firebaseUser?.displayName || "");
  const [board, setBoard] = useState(dbUser?.Board || "Dhaka");
  const [year, setYear] = useState(dbUser?.ExamYEar || "");
  const [phone, setPhone] = useState(
    dbUser?.phone && dbUser.phone !== "none" ? dbUser.phone : "",
  );

  const [avatarFile, setAvatarFile] = useState(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(firebaseUser?.displayName || "");
    setBoard(dbUser?.Board || "Dhaka");
    setYear(dbUser?.ExamYEar || "");
    setPhone(dbUser?.phone && dbUser.phone !== "none" ? dbUser.phone : "");
    setAvatarFile(null);
    setError("");
  }, [open, firebaseUser, dbUser]);

  if (!open) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    let photoChanged = false;

    try {
      // Phone normalize/validate
      const normalized = normalizeBdPhone(phone);
      if (!normalized.ok) throw new Error(normalized.message);

      // 1) Avatar upload (optional)
      if (avatarFile) {
        const storage = getStorage();
        const ext = avatarFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const objectPath = `avatars/${firebaseUser.uid}/avatar.${ext}`;
        const fileRef = storageRef(storage, objectPath);

        await uploadBytes(fileRef, avatarFile);
        const publicUrl = await getDownloadURL(fileRef);

        await updateProfile(firebaseUser, { photoURL: publicUrl });
        photoChanged = true;
      }

      // 2) displayName (optional)
      if (name && name !== firebaseUser.displayName) {
        await updateProfile(firebaseUser, { displayName: name });
      }

      // 3) Backend update (Board + ExamYEar + phone)
      const payload = {
        Board:
          typeof board === "string" && board.trim() ? board.trim() : "none",
        ExamYEar: Number(year) || 0,
        phone: normalized.value || "none",
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
          // If your backend verifies tokens, uncomment:
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

      onSaved?.(updatedDbUser, photoChanged);
      onClose?.();
    } catch (err) {
      console.error("PROFILE SAVE ERROR:", err);
      setError(err?.message || "Could not save changes.");
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
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Edit Profile</h3>
          <button
            className="text-sm text-gray-500 hover:text-gray-800 dark:text-gray-300"
            onClick={onClose}
            disabled={saving}
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

            {/* Phone */}
            <div>
              <label className="mb-1 block text-sm font-medium">
                Phone Number
              </label>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-gray-700 dark:bg-gray-800"
                placeholder="01XXXXXXXXX"
              />
              <p className="mt-1 text-xs text-gray-500">
                Format: 01XXXXXXXXX (or +8801XXXXXXXXX)
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

            {/* Avatar */}
            <div>
              <label className="mb-1 block text-sm font-medium">
                Profile Photo (optional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                className="block w-full text-sm"
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
