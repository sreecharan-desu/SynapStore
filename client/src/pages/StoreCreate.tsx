import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRecoilState } from "recoil";
import { authState } from "../state/auth";
import { jsonFetch } from "../utils/api";

const StoreCreate = () => {
  const [auth, setAuth] = useRecoilState(authState);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [currency, setCurrency] = useState("INR");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const createStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!auth.token) {
      setError("Please sign in again.");
      navigate("/login");
      return;
    }
    try {
      setLoading(true);
      const response = await jsonFetch<any>("/api/v1/store/create", {
        method: "POST",
        body: JSON.stringify({ name, slug, timezone, currency }),
        token: auth.token,
      });

      // Handle wrapped response structure
      const effectiveStore = response.data?.effectiveStore || response.effectiveStore;

      setAuth({
        ...auth,
        effectiveStore: effectiveStore,
        needsStoreSetup: false,
      });
      setSuccess(response.message || "Store created successfully. Redirecting to dashboard...");
      setTimeout(() => navigate("/store/dashboard"), 1000);
    } catch (err: any) {
      setError(err.message || "Could not create store");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
        <div className="space-y-3">
          <p className="text-blue-200 text-sm uppercase tracking-wide">Onboarding</p>
          <h1 className="text-3xl font-semibold text-white">Create your first store</h1>
          <p className="text-slate-200/80">
            We detected you need a store. Fill in a few details to get started.
          </p>
          <ul className="text-slate-200/70 text-sm space-y-1 list-disc list-inside">
            <li>Store owner role assigned automatically.</li>
            <li>You can change timezone/currency later in settings.</li>
            <li>Data is secured; JWT attached to this request.</li>
          </ul>
        </div>
        <form onSubmit={createStore} className="space-y-4">
          {error && (
            <div className="text-sm text-red-100 bg-red-500/20 border border-red-500/40 p-2 rounded">
              {error}
            </div>
          )}
          {success && (
            <div className="text-sm text-emerald-100 bg-emerald-500/10 border border-emerald-400/30 p-2 rounded">
              {success}
            </div>
          )}
          <div>
            <label className="block text-sm text-slate-100 mb-1">Store name</label>
            <input
              className="w-full px-4 py-2 border border-white/20 bg-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-white placeholder:text-slate-300"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Acme Inc."
            />
          </div>
          <div>
            <label className="block text-sm text-slate-100 mb-1">Slug</label>
            <input
              className="w-full px-4 py-2 border border-white/20 bg-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-white placeholder:text-slate-300"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              placeholder="acme-inc"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-100 mb-1">Timezone</label>
              <input
                className="w-full px-4 py-2 border border-white/20 bg-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-white placeholder:text-slate-300"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-100 mb-1">Currency</label>
              <input
                className="w-full px-4 py-2 border border-white/20 bg-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-white placeholder:text-slate-300"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-60 shadow-lg shadow-blue-500/20"
          >
            {loading ? "Creating..." : "Create store"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default StoreCreate;

