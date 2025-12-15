import { LogOut, Loader2, Building2, Truck, Rocket, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRecoilState } from "recoil";
import { authState } from "../state/auth";
import { jsonFetch } from "../utils/api";
import { motion, AnimatePresence } from "framer-motion";
import { DottedSurface } from "../components/ui/dotted-surface";
import { dashboardApi } from "../lib/api/endpoints";

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
  const [timezone] = useState(defaultTimezone);
  const [currency] = useState(defaultCurrency);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [theme] = useState("green");
  const [avatar] = useState("fruit-strawberry");
  const [selectedRole, setSelectedRole] =
    useState<"STORE_OWNER" | "SUPPLIER" | null>(null);

  // const avatars = [
  //   { id: "fruit-strawberry", src: "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f353.svg", name: "Strawberry" },
  //   { id: "fruit-pineapple", src: "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f34d.svg", name: "Pineapple" },
  //   { id: "fruit-watermelon", src: "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f349.svg", name: "Watermelon" },
  //   { id: "fruit-grapes", src: "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f347.svg", name: "Grapes" },
  // ];

  // const colors = [
  //   { id: "green", hex: "#059669", ring: "ring-emerald-500", name: "Green" }, // emerald-600
  //   { id: "red", hex: "#dc2626", ring: "ring-red-500", name: "Red" }, // red-600
  //   { id: "orange", hex: "#f97316", ring: "ring-orange-500", name: "Orange" }, // orange-500
  //   { id: "blue", hex: "#2563eb", ring: "ring-blue-500", name: "Blue" }, // blue-600
  //   { id: "black", hex: "#0f172a", ring: "ring-slate-900", name: "Black" }, // slate-900
  // ];


  useEffect(() => {
    // Check if role updated while on this screen
    const checkRole = async () => {
        try {
            const res = await dashboardApi.getStore(); // or getBootstrap
            if (res.data.success) {
                const fetchedUser = res.data.data.user;
                if (auth.user && fetchedUser.globalRole !== auth.user.globalRole) {
                    setAuth((prev: any) => ({
                        ...prev,
                        user: { ...prev.user, globalRole: fetchedUser.globalRole }
                    }));
                    if (fetchedUser.globalRole === "SUPPLIER") {
                        alert("Access Updated: Congrats you are now a SUPPLIER!");
                        // Navigation will happen automatically via RoleGuard or logic below
                    }
                }
            }
        } catch (e: any) {
            // Check for specific "no_store_found" error which now carries the user role
            // Depending on how jsonFetch throws, key might vary. Usually e is the thrown error.
            // If jsonFetch throws the parsed JSON body as `error` property or similar, we inspect it.
            // Based on previous files, jsonFetch throws an Error object with extra props if code/details exist.
            
            if (e.code === "no_store_found" && e.details?.user?.globalRole) {
                 const fetchedRole = e.details.user.globalRole;
                 if (auth.user && fetchedRole !== auth.user.globalRole) {
                    setAuth((prev: any) => ({
                        ...prev,
                        user: { ...prev.user, globalRole: fetchedRole }
                    }));
                    if (fetchedRole === "SUPPLIER") {
                        alert("Access Updated: Congrats you are now a SUPPLIER!");
                        navigate("/supplier/dashboard", { replace: true });
                    }
                 }
            }
        }
    };
    if (auth.token) checkRole();
  }, [auth.token]);

  useEffect(() => {
    if (!auth.needsStoreSetup && auth.effectiveStore) {
      navigate("/dashboard", { replace: true });
    }
  }, [auth.needsStoreSetup, auth.effectiveStore, navigate]);

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

  const handleLogout = () => {
    setAuth({
      token: null,
      user: null,
      effectiveStore: null,
      needsStoreSetup: false,
      needsStoreSelection: false,
      suppliers: [],
      supplierId: null,
    });
    navigate("/login");
  };

  const createStore = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
          settings: { theme, avatar }, // Passing theme and avatar in settings
        }),
        token: auth.token,
      });

      setAuth({
        ...auth,
        globalRole: "STORE_OWNER", // Explicitly set top-level role
        user: auth.user ? { ...auth.user, globalRole: "STORE_OWNER" } : null,
        effectiveStore: body.effectiveStore,
        needsStoreSetup: false,
      });

      setSuccess("Store created successfully. Redirecting to dashboard...");
      setTimeout(() => navigate("/dashboard", { replace: true }), 500);
    } catch (err: any) {
      setError(err?.message || "Could not create store. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-emerald-100 p-4 md:p-6">
      <DottedSurface className="hidden md:block" />

      {/* Background Blobs */}
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

      <button
        onClick={handleLogout}
        className="hidden md:flex absolute top-6 right-6 items-center gap-2 text-slate-500 hover:text-emerald-600 transition-colors z-50 bg-white/50 backdrop-blur-sm px-4 py-2 rounded-full hover:bg-white/80 shadow-sm"
      >
        <span className="text-sm font-medium">Logout</span>
        <LogOut className="w-4 h-4" />
      </button>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-4xl bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2 relative z-10"
      >
        {/* Left Panel: Info */}
        <div className="relative p-8 md:p-10 bg-gradient-to-br from-emerald-50/50 to-teal-50/20 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col justify-center">
          {/* Mobile Logout Button */}
          <button
            onClick={handleLogout}
            className="md:hidden absolute top-4 right-4 flex items-center gap-2 text-slate-500 hover:text-emerald-600 transition-colors bg-white/50 hover:bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm text-xs border border-slate-100/50"
          >
            <span>Logout</span>
            <LogOut className="w-3.5 h-3.5" />
          </button>
          <div className="mb-6">
            <div className="w-12 h-12 bg-white rounded-2xl shadow-lg shadow-emerald-100 flex items-center justify-center mb-6">
              <Rocket className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="text-emerald-600 text-xs font-bold uppercase tracking-widest mb-2">
              Onboarding
            </p>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4 leading-tight">
              Create your <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">first store</span>
            </h1>
            <p className="text-slate-500 text-sm leading-relaxed">
              We noticed you don't have an active store yet. Set up your first
              store to start managing inventory, suppliers, and orders from a
              single unified dashboard.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/60 border border-white/60 shadow-sm">
              <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-emerald-700">1</span>
              </div>
              <p className="text-xs text-slate-600">Store owner role is assigned automatically to your account.</p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/60 border border-white/60 shadow-sm">
              <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-emerald-700">2</span>
              </div>
              <p className="text-xs text-slate-600">You can update timezone and currency settings anytime later.</p>
            </div>
          </div>
        </div>

        {/* Right Panel: Form */}
        <div className="p-8 md:p-10 bg-white/40 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {/* Status messages */}
            {(error || success) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 overflow-hidden"
              >
                {error && (
                  <div className="text-sm rounded-xl border border-red-200 bg-red-50 text-red-600 px-4 py-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                    {error}
                  </div>
                )}
                {success && (
                  <div className="text-sm rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 px-4 py-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    {success}
                  </div>
                )}
              </motion.div>
            )}

            {/* Role selection */}
            {selectedRole === null ? (
              <motion.div
                key="role-select"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <h2 className="text-xl font-bold text-slate-800">
                  How do you want to get started?
                </h2>
                <div className="space-y-3">
                  <button
                    onClick={() => setSelectedRole("STORE_OWNER")}
                    className="w-full group relative p-4 bg-white border border-slate-200 rounded-xl hover:border-violet-300 hover:shadow-lg hover:shadow-violet-500/10 transition-all text-left flex items-center gap-4"
                  >
                    <div className="p-3 rounded-lg bg-violet-50 text-violet-600 group-hover:bg-violet-100 transition-colors">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 group-hover:text-violet-700 transition-colors">I want to be a Store Owner</h3>
                      <p className="text-xs text-slate-400 mt-1">Manage inventory, sales, and staff</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-300 ml-auto group-hover:text-violet-500 group-hover:translate-x-1 transition-all" />
                  </button>

                  <button
                    onClick={() => setSelectedRole("SUPPLIER")}
                    className="w-full group relative p-4 bg-white border border-slate-200 rounded-xl hover:border-amber-300 hover:shadow-lg hover:shadow-amber-500/10 transition-all text-left flex items-center gap-4"
                  >
                    <div className="p-3 rounded-lg bg-amber-50 text-amber-600 group-hover:bg-amber-100 transition-colors">
                      <Truck className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 group-hover:text-amber-700 transition-colors">I want to be a Supplier</h3>
                      <p className="text-xs text-slate-400 mt-1 group-hover:text-amber-600/80 transition-colors">Supply products to stores</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-300 ml-auto group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
                  </button>
                </div>
              </motion.div>
            ) : selectedRole === "SUPPLIER" ? (
              <motion.div
                key="supplier-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-center py-6"
              >
                <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Truck className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">
                  Become a Supplier
                </h2>
                <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                  Thanks for your interest in partnering with SynapStore. We are currently onboarding suppliers manually to ensure quality.
                </p>
                <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-100">
                  <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">Contact Us</p>
                  <a href="mailto:contact@synapstore.me" className="text-blue-600 font-medium hover:underline text-sm">
                    contact@synapstore.me
                  </a>
                </div>
                <button
                  onClick={() => setSelectedRole(null)}
                  className="text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors"
                >
                  ← Back to role selection
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="store-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <form onSubmit={createStore} className="space-y-5">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xl font-bold text-slate-800">
                      Store Details
                    </h2>
                    <button
                      type="button"
                      onClick={() => setSelectedRole(null)}
                      className="text-xs text-slate-400 hover:text-emerald-600 transition-colors"
                    >
                      Change Role
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="group">
                      <label className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-1.5 ml-1">
                        Store Name
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => handleNameChange(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                        placeholder="e.g. Sunrise Pharmacy"
                        disabled={loading}
                      />
                    </div>

                    <div className="group">
                      <div className="flex justify-start gap-2 mb-1.5 ml-1">
                        <label className="text-slate-700 text-xs font-bold uppercase tracking-wider">
                          Store Slug
                        </label>
                        <span className="text-[10px] text-slate-400 py-0.5 bg-slate-100 px-1.5 rounded border border-slate-200">URL Safe</span>
                      </div>
                      <input
                        type="text"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono text-sm"
                        placeholder="e.g. sunrise-pharmacy"
                        disabled={loading}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="group">
                        <label className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-1.5 ml-1">
                          Timezone
                        </label>
                        <input
                          type="text"
                          value="Asia/Kolkata"
                          readOnly
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 font-medium focus:outline-none cursor-not-allowed"
                        />
                      </div>

                      <div className="group">
                        <label className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-1.5 ml-1">
                          Currency
                        </label>
                        <input
                          type="text"
                          value="INR (₹)"
                          readOnly
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 font-medium focus:outline-none cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl shadow-slate-900/20 transition-all active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 group hover:bg-slate-800"
                    >
                      {loading ? (
                        <Loader2 className="animate-spin w-5 h-5" />
                      ) : (
                        <>
                          Create Store
                          <Rocket className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div >
    </div >
  );
};

export default StoreCreate;
