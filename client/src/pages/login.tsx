// src/components/Login.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setCookie } from "../utils/cookieUtils";

/**
 * Uses global BASE_URL (try window.BASE_URL or process.env.REACT_APP_BASE_URL)
 */
const BASE_URL = "http://localhost:3000";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60; // seconds default if server doesn't provide expiry

const Login: React.FC = () => {
  const navigate = useNavigate();

  // form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignup, setIsSignup] = useState(false);

  // OTP state (6 digits)
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState<string[]>(
    Array.from({ length: OTP_LENGTH }).map(() => "")
  );
  const [timer, setTimer] = useState(0);

  // loading / error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      // prefer structured { error: "..." } shape
      const msg =
        (body && (body.error || body.message || JSON.stringify(body))) ||
        res.statusText;
      throw new Error(msg);
    }
    return body;
  };

  // Register -> create user, server sends OTP to email
  const register = async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await jsonFetch("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username: email.split("@")[0] || email,
          email,
          password,
        }),
      });
      // success: show OTP UI
      setShowOtp(true);
      setIsSignup(true);
      setTimer(RESEND_COOLDOWN); // start cooldown; backend expiry may differ
      // server returns user object; don't store sensitive things here
      return body;
    } catch (err: any) {
      setError(err.message || "Registration failed");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Sign in (email + password) -> receives JWT token & user
  const signin = async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await jsonFetch("/api/v1/auth/signin", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      // Expect: { token: "<jwt>", user: { ... } }
      if (body.token) {
        // cookie expiry: 7 days
        setCookie("token", body.token, 7);
        setCookie("isLoggedIn", "true", 7);
        // navigate to home (or wherever)
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

  // Resend OTP
  const resendOtp = async () => {
    if (!email) {
      setError("Please provide an email to resend OTP");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await jsonFetch("/api/v1/auth/resend-otp", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setTimer(RESEND_COOLDOWN);
    } catch (err: any) {
      setError(err.message || "Could not resend OTP");
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const verifyOtp = async () => {
    const code = otp.join("");
    if (code.length < OTP_LENGTH) {
      setError(`Please enter the ${OTP_LENGTH}-digit OTP`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await jsonFetch("/api/v1/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email, otp: code }),
      });
      // success: clear UI and show success. If this was signup, user can now sign in.
      setShowOtp(false);
      setIsSignup(false);
      setOtp(Array.from({ length: OTP_LENGTH }).map(() => ""));
      setEmail("");
      setPassword("");
      alert("OTP verified — you can now sign in");
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
      // error state already set in functions
    }
  };

  // OTP input helpers (6 boxes)
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

  // Simple UI rendering
  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-50 to-white p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h2 className="text-2xl font-semibold text-center mb-6">
          {isSignup ? "Create your account" : "Welcome Back"}
        </h2>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded">
            {error}
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
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(e, i)}
                  onPaste={handleOtpPaste}
                  className="w-12 h-12 text-center border rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                  disabled={loading}
                />
              ))}
            </div>

            <div className="flex gap-4">
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
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-8 text-sm text-gray-600 px-2 py-1 rounded"
                tabIndex={-1}
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
          </form>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          {isSignup ? "Already have an account? " : "Don't have an account? "}
          <button
            type="button"
            onClick={() => {
              // toggling resets OTP ui & errors
              setIsSignup((s) => !s);
              setShowOtp(false);
              setOtp(Array.from({ length: OTP_LENGTH }).map(() => ""));
              setError(null);
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
