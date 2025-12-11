// src/pages/login.tsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSetRecoilState } from "recoil";
import { authState, type AuthUser, type EffectiveStore } from "../state/auth";
import { jsonFetch } from "../utils/api";
// Icons
import { FcGoogle } from "react-icons/fc";
import { Mail, Lock, ArrowRight, Loader2, CheckCircle2, RefreshCw, Eye, EyeOff } from "lucide-react";
// Animation
import { motion, AnimatePresence } from "framer-motion";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

// Development fallback google client id
const PROVIDED_GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

declare global {
  interface Window {
    google?: any;
    GOOGLE_CLIENT_ID?: string;
  }
}

const getGoogleClientId = (): string => {
  const win = window as any;
  const fromWindow = win.GOOGLE_CLIENT_ID;
  const fromVite =
    typeof import.meta !== "undefined"
      ? (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID
      : undefined;
  const fromCRA =
    typeof process !== "undefined"
      ? (process.env as any)?.REACT_APP_GOOGLE_CLIENT_ID
      : undefined;

  try {
    if ((import.meta as any)?.env?.DEV) {
      console.info("Google Client ID lookup:", {
        fromWindow,
        fromVite,
        fromCRA,
        provided: PROVIDED_GOOGLE_CLIENT_ID,
      });
    }
  } catch {
    /* ignore */
  }

  return fromWindow || fromVite || fromCRA || PROVIDED_GOOGLE_CLIENT_ID;
};

type SigninResponse = {
  data: {
      token: string;
  user: AuthUser;
  effectiveStore: EffectiveStore | null;
  needsStoreSetup?: boolean;
  needsStoreSelection?: boolean;
  suppliers?: any[];
  supplierId?: { id: string } | null;
  stores?: any[];
  }

};

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useSetRecoilState(authState);

  // form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignup, setIsSignup] = useState(false);

  // OTP state
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState<string[]>(
    Array.from({ length: OTP_LENGTH }).map(() => "")
  );
  const [timer, setTimer] = useState(0);

  // loading / messages
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Google button container ref + render flag
  const googleBtnRef = useRef<HTMLDivElement | null>(null);
  const [googleRendered, setGoogleRendered] = useState(false);
  const googleClientId = getGoogleClientId();

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (timer > 0) {
      interval = setInterval(() => setTimer((t) => Math.max(0, t - 1)), 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timer]);

  // Helpers
  const handleAuthSuccess = (body: SigninResponse) => {
    setAuth({
      token: body.data.token,
      user: body.data.user,
      effectiveStore: body.data.effectiveStore ?? null,
      needsStoreSetup: Boolean(body.data.needsStoreSetup),
      needsStoreSelection: Boolean(body.data.needsStoreSelection),
      suppliers: body.data.suppliers ?? [],
      supplierId: body.data.supplierId ?? null,
    });

    // Role-based redirects
    const globalRole = body.data.user?.globalRole;

    // SUPERADMIN → SuperAdminDashboard
    if (globalRole === "SUPERADMIN") {
      navigate("/admin/dashboard", { replace: true });
      return;
    }

    // SUPPLIER → SupplierDashboard
    if (globalRole === "SUPPLIER") {
      navigate("/supplier/dashboard", { replace: true });
      return;
    }

    // STORE_OWNER → needs store setup or store dashboard
    if (body.data.needsStoreSetup) {
      navigate("/store/create", { replace: true });
      return;
    }

    // STORE_OWNER with store(s) → StoreOwnerDashboard
    if (globalRole === "STORE_OWNER" || body.data.effectiveStore) {
      navigate("/store/dashboard", { replace: true });
      return;
    }

    // Default fallback
    const redirectTo =
      (location.state as any)?.from?.pathname || "/dashboard";
    navigate(redirectTo, { replace: true });
  };

  const register = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const body = await jsonFetch("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username: email.split("@")[0] || email,
          email,
          password,
        }),
      });
      setShowOtp(true);
      setIsSignup(true);
      setTimer(RESEND_COOLDOWN);
      setSuccess("OTP sent to your email");
      return body;
    } catch (err: any) {
      setError(err.message || "Registration failed");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signin = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const body = await jsonFetch<SigninResponse>("/api/v1/auth/signin", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (body.data.token) {
        handleAuthSuccess(body);
      } else {
        throw new Error("no token returned");
      }
      return body;
    } catch (err: any) {
      setError(err.message || "Sign in failed");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const body = await jsonFetch<SigninResponse>("/api/v1/oauth/google", {
        method: "POST",
        body: JSON.stringify({ idToken: credential }),
      });
      if (body.data.token) {
        handleAuthSuccess(body);
      } else {
        throw new Error("No token returned from Google auth endpoint");
      }
      return body;
    } catch (err: any) {
      setError(err.message || "Google sign-in failed");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (!email) {
      setError("Please provide an email to resend OTP");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await jsonFetch("/api/v1/auth/resend-otp", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setTimer(RESEND_COOLDOWN);
      setSuccess("OTP resent");
    } catch (err: any) {
      setError(err.message || "Could not resend OTP");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    const code = otp.join("");
    if (code.length < OTP_LENGTH) {
      setError(`Please enter the ${OTP_LENGTH}-digit OTP`);
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await jsonFetch("/api/v1/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email, otp: code }),
      });
      setShowOtp(false);
      setIsSignup(false);
      setOtp(Array.from({ length: OTP_LENGTH }).map(() => ""));
      setEmail("");
      setPassword("");
      setSuccess("OTP verified - you can now sign in");
    } catch (err: any) {
      setError(err.message || "OTP verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    try {
      if (isSignup) {
        await register();
      } else {
        await signin();
      }
    } catch {
      // errors already set
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^[0-9]*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < OTP_LENGTH - 1) {
      const nextEl = document.getElementById(`otp-${index + 1}`) as HTMLInputElement | null;
      nextEl?.focus();
      nextEl?.select();
    }
  };

  const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    const target = e.target as HTMLInputElement;
    if (e.key === "Backspace" && !target.value && index > 0) {
      const prev = document.getElementById(`otp-${index - 1}`) as HTMLInputElement | null;
      prev?.focus();
      prev?.select();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const paste = e.clipboardData.getData("text").trim();
    if (!new RegExp(`^[0-9]{${OTP_LENGTH}}$`).test(paste)) return;
    const arr = paste.split("");
    setOtp(arr);
    const last = document.getElementById(`otp-${OTP_LENGTH - 1}`) as HTMLInputElement | null;
    last?.focus();
  };

  useEffect(() => {
    try {
      (window as any).GOOGLE_CLIENT_ID = googleClientId;
    } catch {
      /* ignore */
    }

    let script: HTMLScriptElement | null = null;
    let initialized = false;

    const loadAndInit = () => {
      if (!googleClientId) return;
      if (!window.google || !window.google.accounts || !window.google.accounts.id) {
        if (!script) return;
      }

      try {
        if (initialized || !window.google?.accounts?.id) return;
        initialized = true;

        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (resp: any) => {
            if (resp && resp.credential) {
              handleGoogleCredential(resp.credential).catch(() => { });
            } else {
              setError("Google sign-in failed: no credential returned");
            }
          },
        });

        if (googleBtnRef.current) {
          try {
            window.google.accounts.id.renderButton(googleBtnRef.current, {
              theme: "outline",
              size: "large",
              type: "standard",
            });
            setGoogleRendered(true);
          } catch (err) {
            console.warn("Google button render failed", err);
            setGoogleRendered(false);
          }
        }
      } catch (err) {
        console.error("Failed to initialize Google Identity", err);
        setGoogleRendered(false);
      }
    };

    if (!document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
      script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => loadAndInit();
      script.onerror = () => {
        setError("Could not load Google Identity script");
        setGoogleRendered(false);
      };
      document.head.appendChild(script);
    } else {
      loadAndInit();
    }

    const retryTimer = setTimeout(loadAndInit, 600);
    return () => clearTimeout(retryTimer);
  }, [googleClientId]);

  const manualGoogleSignIn = () => {
    if (!googleClientId) {
      setError("Google Client ID not configured.");
      return;
    }
    if (!window.google?.accounts?.id) {
      setError("Google Identity not available in this browser.");
      return;
    }
    try {
      window.google.accounts.id.prompt();
    } catch {
      setError("Could not start Google sign-in flow");
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-emerald-100">
      {/* Dynamic Background Elements */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
          x: [0, 50, 0],
          y: [0, -30, 0],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-300/20 rounded-full blur-[100px] pointer-events-none"
      />
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.3, 0.4, 0.3],
          x: [0, -30, 0],
          y: [0, 50, 0],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-teal-300/20 rounded-full blur-[100px] pointer-events-none"
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-lg p-6"
      >
        <div className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl shadow-2xl overflow-hidden p-8 md:p-10">

          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                SynapStore
              </h1>
              <p className="text-slate-500 mt-2 text-sm">
                Empowering your business with intelligence
              </p>
            </motion.div>
          </div>

          <AnimatePresence mode="wait">
            {showOtp ? (
              <motion.div
                key="otp-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-800">Check your inbox</h2>
                  <p className="text-sm text-gray-500 mt-2">
                    We sent a verification code to <br />
                    <span className="font-medium text-gray-900">{email}</span>
                  </p>
                </div>

                <div className="flex justify-center gap-3 my-6">
                  {otp.map((d, i) => (
                    <motion.input
                      key={i}
                      id={`otp-${i}`}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={d}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(e, i)}
                      onPaste={handleOtpPaste}
                      className="w-12 h-14 bg-gray-50 border border-gray-200 rounded-xl text-center text-xl font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm"
                      disabled={loading}
                    />
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={verifyOtp}
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-3 rounded-xl font-medium hover:shadow-lg hover:shadow-emerald-500/30 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                  >
                    {loading ? <Loader2 className="animate-spin w-5 h-5" /> : "Verify"}
                  </button>
                  <button
                    onClick={resendOtp}
                    disabled={timer > 0 || loading}
                    className="px-6 py-3 rounded-xl font-medium border border-gray-200 hover:bg-gray-50 text-gray-600 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {timer > 0 ? (
                      <span className="text-xs font-mono">{timer}s</span>
                    ) : (
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    )}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="auth-form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <form onSubmit={handleSubmit} className="space-y-5">
                  {(error || success) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      className={`text-sm p-3 rounded-lg flex items-center gap-2 ${error ? "bg-red-50 text-red-600 border border-red-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                        }`}
                    >
                      {error ? (
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      )}
                      {error || success}
                    </motion.div>
                  )}

                  <div className="space-y-4">
                    <div className="relative group">
                      <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="Email address"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        disabled={loading}
                      />
                    </div>

                    <div className="relative group">
                      <Lock className="absolute left-3 top-3.5 w-5 h-5 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="Password"
                        className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3.5 text-gray-400 hover:text-emerald-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-3 h-3 flex-shrink-0" /> : <Eye className="w-3 h-3 flex-shrink-0" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3.5 rounded-xl font-medium text-lg shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                  >
                    {loading ? (
                      <Loader2 className="animate-spin w-5 h-5" />
                    ) : (
                      <>
                        {isSignup ? "Create Account" : "Sign In"}
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </form>

                <div className="my-6 flex items-center gap-4">
                  <div className="h-px bg-gray-200 flex-1" />
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Or continue with</span>
                  <div className="h-px bg-gray-200 flex-1" />
                </div>

                <div className="min-h-[50px] flex justify-center">
                  <div ref={googleBtnRef} />
                  {!googleRendered && (
                    <button
                      onClick={() => manualGoogleSignIn()}
                      className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors shadow-sm"
                    >
                      <FcGoogle className="w-5 h-5" />
                      <span className="text-sm">Google</span>
                    </button>
                  )}
                </div>

                <div className="mt-8 text-center">
                  <p className="text-sm text-gray-500">
                    {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
                    <b
                      onClick={() => {
                        setIsSignup(!isSignup);
                        setError(null);
                        setSuccess(null);
                      }}
                      className="font-semibold cursor-pointer text-emerald-600 hover:text-emerald-700 hover:underline transition-all ml-1"
                    >
                      {isSignup ? "Log in" : "Sign up"}
                    </b>
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer simple copy */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-400">
            &copy; {new Date().getFullYear()} SynapStore. All rights reserved.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;

