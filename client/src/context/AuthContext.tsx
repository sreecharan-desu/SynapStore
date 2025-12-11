import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import CryptoJS from "crypto-js";
import { useRecoilValue } from "recoil";
import { authState, authStatus } from "../state/auth";

type AuthContextValue = {
  user: any | null;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthenticated: false,
});

const STORAGE_KEY = "auth:encUser";
const AES_KEY = "synapstore-local-user-key";

const encrypt = (data: any) => {
  try {
    const plaintext = JSON.stringify(data);
    return CryptoJS.AES.encrypt(plaintext, AES_KEY).toString();
  } catch {
    return null;
  }
};

const decrypt = (cipher: string | null) => {
  if (!cipher) return null;
  try {
    const bytes = CryptoJS.AES.decrypt(cipher, AES_KEY);
    const plaintext = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(plaintext);
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const auth = useRecoilValue(authState);
  const status = useRecoilValue(authStatus);
  const [storedUser, setStoredUser] = useState<any | null>(null);

  // hydrate from encrypted storage
  useEffect(() => {
    try {
      const cipher = localStorage.getItem(STORAGE_KEY);
      const decoded = decrypt(cipher);
      if (decoded) setStoredUser(decoded);
    } catch {
      /* ignore */
    }
  }, []);

  // persist encrypted user when auth.user changes
  useEffect(() => {
    const cipher = encrypt(auth.user);
    if (cipher) {
      localStorage.setItem(STORAGE_KEY, cipher);
      setStoredUser(auth.user);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      setStoredUser(null);
    }
    if (!auth.user) {
      localStorage.removeItem(STORAGE_KEY);
      setStoredUser(null);
    }
  }, [auth.user]);

  const value = useMemo(
    () => ({
      user: auth.user ?? storedUser,
      isAuthenticated: status.isAuthenticated,
    }),
    [auth.user, storedUser, status.isAuthenticated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => useContext(AuthContext);

