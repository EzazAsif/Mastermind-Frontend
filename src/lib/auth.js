// src/lib/auth.js
import {
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  linkWithCredential,
  fetchSignInMethodsForEmail,
} from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, setDoc, arrayUnion, serverTimestamp } from "firebase/firestore";

/** =========================
 *  Helper: Friendly Firebase Errors
 * ========================== */
function mapFirebaseAuthError(e, fallback = "Something went wrong.") {
  const code = e?.code || "";
  const raw = (e?.message || "").toUpperCase();

  if (raw.includes("EMAIL_NOT_FOUND") || code === "auth/user-not-found") {
    return "No account found for that email.";
  }
  if (
    raw.includes("INVALID_PASSWORD") ||
    code === "auth/wrong-password" ||
    code === "auth/invalid-credential"
  ) {
    return "Incorrect email or password.";
  }
  if (code === "auth/invalid-email" || raw.includes("INVALID_EMAIL")) {
    return "Please enter a valid email address.";
  }
  if (
    raw.includes("TOO_MANY_ATTEMPTS_TRY_LATER") ||
    code === "auth/too-many-requests"
  ) {
    return "Too many attempts. Please try again later.";
  }
  if (code === "auth/network-request-failed") {
    return "Network error. Please check your connection and try again.";
  }
  if (code === "auth/user-disabled" || raw.includes("USER_DISABLED")) {
    return "This account has been disabled.";
  }
  if (raw.includes("WEAK_PASSWORD")) {
    return "Password should be at least 6 characters.";
  }

  return e?.message || fallback;
}

/** =========================
 *  Firestore Login Tracking
 * ========================== */
async function trackLogin(user) {
  try {
    const userRef = doc(db, "logins", user.uid);

    await setDoc(
      userRef,
      {
        lastLogin: serverTimestamp(),
        loginHistory: arrayUnion(serverTimestamp()), // ✅ always Firestore timestamp
      },
      { merge: true },
    );
  } catch (err) {
    console.error("Login tracking error:", err);
  }
}

/** =========================
 *  Backend URL for registering user
 * ========================== */
const BACKEND_REGISTER_URL =
  "https://ugliest-hannie-ezaz-307892de.koyeb.app/api/register";

/** =========================
 *  Register with Email & Password
 * ========================== */
export async function registerWithEmail({ email, password, displayName }) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }

    await sendEmailVerification(cred.user);

    // Track login
    await trackLogin(cred.user);

    // Send to backend
    const res = await fetch(BACKEND_REGISTER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: cred.user.displayName,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || "Backend registration failed");
    }

    return cred.user;
  } catch (e) {
    console.error("REGISTER ERROR:", e);
    throw new Error(mapFirebaseAuthError(e, "Could not register."));
  }
}

/** =========================
 *  Login with Email & Password
 * ========================== */
export async function loginWithEmail({ email, password }) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await trackLogin(cred.user);
    return cred.user;
  } catch (e) {
    console.error("LOGIN ERROR:", e);
    throw new Error(mapFirebaseAuthError(e, "Could not log in."));
  }
}

/** =========================
 *  Reset Password
 * ========================== */
export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (e) {
    console.error("RESET PASSWORD ERROR:", e);
    throw new Error(
      mapFirebaseAuthError(e, "Could not send password reset email."),
    );
  }
}

/** =========================
 *  Login with Google (link if needed)
 * ========================== */
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    const cred = await signInWithPopup(auth, provider);
    const user = cred.user;

    // Track login
    await trackLogin(user);

    // Send to backend
    await fetch(BACKEND_REGISTER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
      }),
    });

    return user;
  } catch (e) {
    if (e.code === "auth/account-exists-with-different-credential") {
      const email = e.customData?.email || "";
      const pendingCred = GoogleAuthProvider.credentialFromError(e);
      if (!pendingCred) throw new Error("Cannot link credentials.");

      const methods = await fetchSignInMethodsForEmail(auth, email);
      if (methods.includes("password")) {
        const password = window.prompt(
          `An account already exists with ${email}. Please enter your password to link Google login:`,
        );
        const userCred = await signInWithEmailAndPassword(
          auth,
          email,
          password,
        );

        // Link Google credential
        await linkWithCredential(userCred.user, pendingCred);

        // Track login
        await trackLogin(userCred.user);

        // Send to backend
        await fetch(BACKEND_REGISTER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid: userCred.user.uid,
            email: userCred.user.email,
            displayName: userCred.user.displayName,
          }),
        });

        return userCred.user;
      } else {
        throw new Error(
          `Account exists with a different sign-in method: ${methods.join(", ")}`,
        );
      }
    }

    console.error("GOOGLE LOGIN ERROR:", e);
    throw new Error(mapFirebaseAuthError(e, "Could not login with Google."));
  }
}
