// components/AuthModal.jsx
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  loginWithEmail,
  registerWithEmail,
  resetPassword,
  loginWithGoogle,
} from "../lib/auth";

export default function AuthModal({ open, mode = "login", onClose }) {
  const [tab, setTab] = useState(mode); // 'login' | 'register' | 'forgot'
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setTab(mode);
  }, [mode]);

  if (!open) return null;

  const onSubmit = async (e) => {
    e.preventDefault();
    setPending(true);
    setMsg("");

    try {
      if (tab === "login") {
        await loginWithEmail({ email, password });
        setMsg("Logged in!");
        setTimeout(() => onClose?.(), 800);
      } else if (tab === "register") {
        await registerWithEmail({ email, password, displayName });
        setMsg("Registered! Check your email for verification.");
        setTimeout(() => onClose?.(), 1000);
      } else if (tab === "forgot") {
        await resetPassword(email);
        setMsg("Password reset email sent.");
      }
    } catch (err) {
      console.error(err); // log Firebase error
      let message = "Something went wrong.";
      if (err?.code) {
        switch (err.code) {
          case "auth/user-not-found":
            message = "No account found with this email.";
            break;
          case "auth/invalid-email":
            message = "Email is invalid.";
            break;
          case "auth/too-many-requests":
            message = "Too many attempts. Please try again later.";
            break;
          default:
            message = err.message;
        }
      }
      setMsg(message);
    } finally {
      setPending(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setPending(true);
      await loginWithGoogle();
      setMsg("Logged in with Google!");
      setTimeout(() => onClose?.(), 800);
    } catch (err) {
      console.error(err);
      setMsg(err?.message || "Google login failed.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-lg"
      >
        {/* Tabs */}
        <div className="mb-4 grid grid-cols-3 gap-2 text-xs">
          {["login", "register", "forgot"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-2 py-1 capitalize ${
                tab === t
                  ? "bg-teal-600 text-white"
                  : "border border-gray-200 dark:border-gray-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          {tab === "register" && (
            <div>
              <label className="block text-xs mb-1">Display name</label>
              <input
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
              />
            </div>
          )}

          <div>
            <label className="block text-xs mb-1">Email</label>
            <input
              required
              type="email"
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          {tab !== "forgot" && (
            <div>
              <label className="block text-xs mb-1">Password</label>
              <input
                required
                type="password"
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          )}

          {msg && (
            <p className="text-xs text-teal-700 dark:text-teal-300">{msg}</p>
          )}

          {tab === "login" && (
            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={() => setTab("forgot")}
                className="text-xs text-teal-700 hover:underline"
              >
                Forgot password?
              </button>
            </div>
          )}

          {/* Submit + Cancel */}
          <div className="flex items-center justify-between">
            <div />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-full bg-teal-600 text-white px-3 py-1.5 text-xs hover:bg-teal-700 disabled:opacity-70"
              >
                {pending
                  ? "Please wait..."
                  : tab === "login"
                    ? "Log in"
                    : tab === "register"
                      ? "Register"
                      : "Send reset"}
              </button>
            </div>
          </div>
        </form>

        {/* Google login */}
        {tab === "login" && (
          <div className="flex justify-center mt-3">
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <img src="/google-icon.png" alt="Google" className="h-4 w-4" />
              Login with Google
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
