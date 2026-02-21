// src/hooks/useAuthState.js
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../lib/firebase";

export function useAuthState() {
  const [user, setUser] = useState(() => auth.currentUser);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);
  return { user, loading, signOut: () => signOut(auth) };
}
