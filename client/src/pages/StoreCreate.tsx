import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRecoilState } from "recoil";
import { authState } from "../state/auth";
import { jsonFetch } from "../utils/api";

type StoreResponse = {
  success: boolean;
  message: string;
  effectiveStore: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    currency: string;
    settings: any;
    roles: string[];
  };
};

const defaultTimezone = "Asia/Kolkata";
const defaultCurrency = "INR";

const StoreCreate = () => {
  const [auth, setAuth] = useRecoilState(authState);
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [timezone, setTimezone] = useState(defaultTimezone);
  const [currency, setCurrency] = useState(defaultCurrency);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] =
    useState<"STORE_OWNER" | "SUPPLIER" | null>(null);

  const slugify = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slug) {
      setSlug(slugify(value));
    }
  };

  const createStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!auth.token) {
      setError("Session expired. Please sign in again.");
      navigate("/login");
      return;
    }

    if (!name.trim()) {
      setError("Store name is required.");
      return;
    }

    if (!slug.trim()) {
      setError("Store slug is required.");
      return;
    }

    try {
      setLoading(true);

      const body = await jsonFetch<StoreResponse>("/api/v1/store/create", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          slug: slugify(slug),
          timezone,
          currency,
        }),
        token: auth.token,
      });

      setAuth({
        ...auth,
        effectiveStore: body.effectiveStore,
        needsStoreSetup: false,
      });

      setSuccess("Store created successfully. Redirecting to dashboard...");
      setTimeout(() => navigate("/dashboard"), 500);
    } catch (err: any) {
      setError(err?.message || "Could not create store. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
        {/* Left panel */}
        <div className="space-y-4">
          <p className="text-blue-200 text-xs font-semibold uppercase tracking-[0.2em]">
            Onboarding
          </p>
          <h1 className="text-3xl font-semibold text-white">
            Create your first store
          </h1>
          <p className="text-slate-200/80 text-sm">
            We noticed you do not have an active store yet. Set up your first
            store to start managing inventory, suppliers, and orders from a
            single place.
          </p>
          <ul className="text-slate-200/75 text-sm space-y-1 list-disc list-inside">
            <li>Store owner role is assigned automatically.</li>
            <li>You can update timezone and currency later in settings.</li>
            <li>All requests are secured with your JWT session.</li>
          </ul>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Status messages */}
          {(error || success) && (
            <div className="space-y-2">
              {error && (
                <div className="text-sm rounded-lg border border-red-500/40 bg-red-500/10 text-red-200 px-3 py-2">
                  {error}
                </div>
              )}
              {success && (
                <div className="text-sm rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 px-3 py-2">
                  {success}
                </div>
              )}
            </div>
          )}

          {/* Role selection */}
          {selectedRole === null && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white">
                How do you want to get started?
              </h2>
              <button
                onClick={() => setSelectedRole("STORE_OWNER")}
                className="w-full bg-blue-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-lg shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                I want to be a Store Owner
              </button>
              <button
                onClick={() => setSelectedRole("SUPPLIER")}
                className="w-full bg-slate-700 text-white py-3 rounded-lg text-sm font-medium hover:bg-slate-800 transition shadow-lg shadow-slate-700/30 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                I want to be a Supplier
              </button>
            </div>
          )}

          {/* Supplier view */}
          {selectedRole === "SUPPLIER" && (
            <div className="space-y-4 text-center">
              <h2 className="text-xl font-semibold text-white">
                Become a Supplier
              </h2>
              <p className="text-slate-200/80 text-sm">
                Thanks for your interest in partnering with SynapStore as a
                supplier. We are currently onboarding suppliers manually to
                ensure quality and the right fit.
              </p>
              <p className="text-blue-300 font-medium text-sm">
                Email:{" "}
                <a
                  href="mailto:contact@synapstore.me"
                  className="underline underline-offset-2"
                >
                  contact@synapstore.me
                </a>
              </p>
              <button
                onClick={() => setSelectedRole(null)}
                className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                Back to role selection
              </button>
            </div>
          )}

          {/* Store owner form */}
          {selectedRole === "STORE_OWNER" && (
            <form onSubmit={createStore} className="space-y-4">
              <h2 className="text-xl font-semibold text-white">
                Store details
              </h2>

              <div>
                <label
                  htmlFor="storeName"
                  className="block text-slate-200 text-sm font-medium mb-1"
                >
                  Store name
                </label>
                <input
                  type="text"
                  id="storeName"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 text-white border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="e.g. Sunrise Pharmacy, Metro Med Store"
                  disabled={loading}
                />
              </div>

              <div>
                <label
                  htmlFor="storeSlug"
                  className="block text-slate-200 text-sm font-medium mb-1"
                >
                  Store slug
                  <span className="text-slate-400 text-xs ml-1">
                    (used in URLs)
                  </span>
                </label>
                <input
                  type="text"
                  id="storeSlug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 text-white border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="e.g. sunrise-pharmacy"
                  disabled={loading}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="timezone"
                    className="block text-slate-200 text-sm font-medium mb-1"
                  >
                    Timezone
                  </label>
                  <select
                    id="timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 text-white border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    disabled={loading}
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    {/* Add more timezones as you support them */}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="currency"
                    className="block text-slate-200 text-sm font-medium mb-1"
                  >
                    Currency
                  </label>
                  <select
                    id="currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 text-white border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    disabled={loading}
                  >
                    <option value="INR">INR - Indian Rupee</option>
                    {/* Add more currencies as needed */}
                  </select>
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3 rounded-lg text-sm font-medium transition shadow-lg shadow-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                    loading
                      ? "bg-emerald-700/70 text-emerald-100 cursor-not-allowed"
                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                  }`}
                >
                  {loading ? "Creating store..." : "Create store"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedRole(null);
                    setError(null);
                    setSuccess(null);
                  }}
                  disabled={loading}
                  className="w-full bg-slate-700 text-white py-3 rounded-lg text-sm font-medium hover:bg-slate-800 transition shadow-lg shadow-slate-700/30 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                >
                  Back to role selection
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoreCreate;
