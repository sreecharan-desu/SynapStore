import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { setCookie } from "../utils/cookieUtils";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState<string[]>(["", "", "", ""]);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timer]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSignup) {
      // TODO: call backend to create user and send OTP to email
      // switch to OTP entry UI
      setShowOtp(true);
      setTimer(60);
    } else {
      // TODO: replace with real auth logic
      setCookie("isLoggedIn", "true", 7);
      navigate("/home");
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^[0-9]*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    // focus next input when a digit entered
    if (value && index < 3) {
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
    if (!/^[0-9]{4}$/.test(paste)) return;
    const arr = paste.split("");
    setOtp(arr);
    // focus last
    const last = document.getElementById(`otp-3`) as HTMLInputElement | null;
    last?.focus();
  };

  const verifyOtp = () => {
    const code = otp.join("");
    if (code.length < 4) {
      alert("Please enter the 4-digit OTP");
      return;
    }
    // TODO: verify OTP with backend
    alert(`OTP entered: ${code} (mock verified)`);
    setShowOtp(false);
    setIsSignup(false);
    setOtp(["", "", "", ""]);
    setEmail("");
    setPassword("");
  };

  const resendOtp = () => {
    // TODO: call backend to resend OTP
    alert(`Resent OTP to ${email} (mock)`);
    setTimer(60);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h2 className="text-2xl font-semibold text-center mb-6">
          {isSignup ? "Create your account" : "Welcome Back"}
        </h2>

        {/* If OTP stage is active show OTP inputs */}
        {showOtp ? (
          <div className="space-y-6">
            <p className="text-center text-sm text-gray-600">
              Check your mail for the OTP sent to{" "}
              <span className="font-medium">{email}</span>
            </p>

            <div className="flex justify-center gap-3">
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
                />
              ))}
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={verifyOtp}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition"
              >
                Verify OTP
              </button>
              <button
                type="button"
                onClick={resendOtp}
                disabled={timer > 0}
                className={`flex-1 py-2 rounded-lg font-medium transition ${
                  timer > 0
                    ? "border border-gray-300 text-gray-400 cursor-not-allowed bg-gray-50"
                    : "border hover:bg-gray-50"
                }`}
              >
                {timer > 0 ? `Resend in ${timer}s` : "Resend"}
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
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-8 text-sm text-gray-600 px-2 py-1 rounded"
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
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition"
            >
              {isSignup ? "Create account" : "Sign in"}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          {isSignup ? "Already have an account? " : "Don't have an account? "}
          <button
            type="button"
            onClick={() => setIsSignup((s) => !s)}
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
