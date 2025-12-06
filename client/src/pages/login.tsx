// src/components/Login.tsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setCookie } from "../utils/cookieUtils";
import { FcGoogle } from "react-icons/fc";

/**
 * Uses global BASE_URL (try window.BASE_URL or import.meta/env)
 */
const BASE_URL =
  (window as any).BASE_URL ||
  (typeof import.meta !== "undefined"
    ? (import.meta as any).env?.VITE_BASE_URL
    : undefined) ||
  (typeof process !== "undefined"
    ? (import.meta.env as any)?.REACT_APP_BASE_URL
    : undefined) ||
  "http://localhost:3000";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60; // seconds fallback if server does not provide expiry

// Development fallback google client id - replace with your config if needed
const PROVIDED_GOOGLE_CLIENT_ID =
  "725689508552-prvotvild62vcf5rsk70ridh26v6sfve.apps.googleusercontent.com";

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

  // keep light dev diagnostic
  try {
    if ((import.meta as any)?.env?.DEV) {
      // eslint-disable-next-line no-console
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

const Login: React.FC = () => {
  const navigate = useNavigate();

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
  const jsonFetch = async (path: string, opts?: RequestInit) => {
    const url = `${BASE_URL}${path}`;
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...opts,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        (body && (body.error || body.message || JSON.stringify(body))) ||
        res.statusText;
      throw new Error(msg);
    }
    return body;
  };

  // Register - server sends OTP to email
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

  // Sign in - preserves your existing logic
  const signin = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const body = await jsonFetch("/api/v1/auth/signin", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (body.token) {
        setCookie("token", body.token, 7);
        setCookie("isLoggedIn", "true", 7);
        navigate("/home");
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

  // Google sign-in handler - preserved
  const handleGoogleCredential = async (credential: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const body = await jsonFetch("/api/v1/oauth/google", {
        method: "POST",
        body: JSON.stringify({ idToken: credential }),
      });
      if (body.token) {
        setCookie("token", body.token, 7);
        setCookie("isLoggedIn", "true", 7);
        navigate("/home");
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

  // Resend OTP
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

  // Verify OTP - replaced blocking alert with inline success message
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

  // Form submit
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
      // errors are already set in each function
    }
  };

  // OTP helpers
  const handleOtpChange = (index: number, value: string) => {
    if (!/^[0-9]*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < OTP_LENGTH - 1) {
      const nextEl = document.getElementById(
        `otp-${index + 1}`
      ) as HTMLInputElement | null;
      nextEl?.focus();
      nextEl?.select();
    }
  };

  const handleOtpKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) => {
    const target = e.target as HTMLInputElement;
    if (e.key === "Backspace" && !target.value && index > 0) {
      const prev = document.getElementById(
        `otp-${index - 1}`
      ) as HTMLInputElement | null;
      prev?.focus();
      prev?.select();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const paste = e.clipboardData.getData("text").trim();
    if (!new RegExp(`^[0-9]{${OTP_LENGTH}}$`).test(paste)) return;
    const arr = paste.split("");
    setOtp(arr);
    const last = document.getElementById(
      `otp-${OTP_LENGTH - 1}`
    ) as HTMLInputElement | null;
    last?.focus();
  };

  // Google Identity script loader - preserved, but sets googleRendered when render succeeds
  useEffect(() => {
    try {
      (window as any).GOOGLE_CLIENT_ID = googleClientId;
    } catch {
      /* ignore */
    }

    let script: HTMLScriptElement | null = null;
    let initialized = false;

    const loadAndInit = () => {
      if (!googleClientId) {
        console.warn("Google Client ID not found.");
        setError("Google Client ID not configured. See console for details.");
        return;
      }

      if (
        !window.google ||
        !window.google.accounts ||
        !window.google.accounts.id
      ) {
        if (!script) return;
      }

      try {
        if (initialized || !window.google?.accounts?.id) return;
        initialized = true;

        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (resp: any) => {
            if (resp && resp.credential) {
              handleGoogleCredential(resp.credential).catch(() => {});
            } else {
              setError("Google sign-in failed: no credential returned");
            }
          },
        });

        if (googleBtnRef.current) {
          try {
            // renderButton may create its own button; mark that it was rendered
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

    if (
      !document.querySelector(
        'script[src="https://accounts.google.com/gsi/client"]'
      )
    ) {
      script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => loadAndInit();
      script.onerror = () => {
        console.warn("Failed to load Google Identity script");
        setError("Could not load Google Identity script");
        setGoogleRendered(false);
      };
      document.head.appendChild(script);
    } else {
      loadAndInit();
    }

    const retryTimer = setTimeout(loadAndInit, 600);

    return () => {
      clearTimeout(retryTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleClientId]);

  // Manual google signin fallback
  const manualGoogleSignIn = () => {
    if (!googleClientId) {
      setError("Google Client ID not configured.");
      return;
    }
    if (
      !window.google ||
      !window.google.accounts ||
      !window.google.accounts.id
    ) {
      setError("Google Identity not available in this browser.");
      return;
    }
    try {
      window.google.accounts.id.prompt();
    } catch (err: any) {
      setError("Could not start Google sign-in flow");
    }
  };

  // UI
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        {/* header - subtle product title */}
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold">SynapStore</h1>
          <p className="text-xs text-gray-400 mt-1">Accounts and access</p>
        </div>

        <h2 className="text-2xl font-semibold text-center mb-4">
          {isSignup ? "Create your account" : "Welcome Back"}
        </h2>

        {/* status messages */}
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded"
          >
            {error}
          </div>
        )}
        {success && (
          <div
            role="status"
            aria-live="polite"
            className="mb-4 text-sm text-green-700 bg-green-50 p-2 rounded"
          >
            {success}
          </div>
        )}

        {showOtp ? (
          <div className="space-y-6">
            <p className="text-center text-sm text-gray-600">
              Check your mail for the OTP sent to{" "}
              <span className="font-medium">{email}</span>
            </p>

            <div className="flex justify-center gap-2">
              {otp.map((d, i) => (
                <input
                  key={i}
                  id={`otp-${i}`}
                  aria-label={`OTP digit ${i + 1}`}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(e, i)}
                  onPaste={handleOtpPaste}
                  autoComplete="one-time-code"
                  className="w-12 h-12 text-center border rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:shadow"
                  disabled={loading}
                />
              ))}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={verifyOtp}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-60"
              >
                {loading ? "Verifying..." : "Verify OTP"}
              </button>

              <button
                type="button"
                onClick={resendOtp}
                disabled={timer > 0 || loading}
                className={`flex-1 py-2 rounded-lg font-medium transition ${
                  timer > 0
                    ? "border border-gray-300 text-gray-400 cursor-not-allowed bg-gray-50"
                    : "border hover:bg-gray-50"
                }`}
              >
                {timer > 0
                  ? `Resend in ${timer}s`
                  : loading
                  ? "Sending..."
                  : "Resend"}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                autoComplete="email"
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                disabled={loading}
              />
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 inset-y-0 flex items-center text-sm text-gray-600 px-2 py-1 rounded"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {!isSignup && (
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="h-4 w-4" />
                  Remember me
                </label>
                <button type="button" className="text-blue-600 hover:underline">
                  Forgot?
                </button>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-60"
              disabled={loading}
            >
              {loading
                ? isSignup
                  ? "Creating..."
                  : "Signing in..."
                : isSignup
                ? "Create account"
                : "Sign in"}
            </button>

            {/* divider */}
            <div className="mt-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">
                    or continue with
                  </span>
                </div>
              </div>

              {/* container for Google library button */}
              <div ref={googleBtnRef} className="mt-4 flex justify-center" />

              {/* show manual fallback only if Google library didn't render its button */}
              {!googleRendered && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      manualGoogleSignIn();
                    }}
                    className="w-full mt-1 flex items-center justify-center gap-2 bg-white border border-gray-300 rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <FcGoogle className="w-5 h-5" />
                    {loading
                      ? "Working..."
                      : isSignup
                      ? "Sign up with Google"
                      : "Sign in with Google"}
                  </button>
                </div>
              )}
            </div>
          </form>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          {isSignup ? "Already have an account? " : "Don't have an account? "}
          <button
            type="button"
            onClick={() => {
              setIsSignup((s) => !s);
              setShowOtp(false);
              setOtp(Array.from({ length: OTP_LENGTH }).map(() => ""));
              setError(null);
              setSuccess(null);
            }}
            className="text-blue-600 hover:underline"
          >
            {isSignup ? "Sign in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;
