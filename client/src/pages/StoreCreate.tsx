import { LogOut, Loader2, Building2, Truck, Rocket, ArrowRight, Check, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRecoilState } from "recoil";
import { authState } from "../state/auth";
import { jsonFetch } from "../utils/api";
import { motion, AnimatePresence } from "framer-motion";
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
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

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

  useEffect(() => {
    if (!slug || slug.length < 2) {
      setSlugStatus('idle');
      return;
    }

    const timer = setTimeout(async () => {
      setSlugStatus('checking');
      try {
        const res = await dashboardApi.checkSlugAvailability(slugify(slug));
        if (res.data.success) {
          setSlugStatus(res.data.data.available ? 'available' : 'taken');
        }
      } catch (err) {
        setSlugStatus('idle');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [slug]);

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
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-[#fafafa] p-4 md:p-6">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

      {/* Background Blobs - Made smoother and more premium */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.4, 0.3],
          x: [0, 50, 0],
          y: [0, -30, 0],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-indigo-200/30 rounded-full blur-[120px] pointer-events-none"
      />
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.2, 0.3, 0.2],
          x: [0, -30, 0],
          y: [0, 50, 0],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-[-20%] right-[-10%] w-[700px] h-[700px] bg-black rounded-full blur-[120px] pointer-events-none"
      />

      <button
        onClick={handleLogout}
        className="hidden md:flex absolute top-6 right-6 items-center gap-2 text-slate-500 hover:text-black transition-colors z-50 bg-white/80 backdrop-blur-md border border-slate-200/60 px-4 py-2 rounded-full hover:bg-white shadow-sm hover:shadow group"
      >
        <span className="text-sm font-semibold">Logout</span>
        <LogOut className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </button>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-5xl bg-white/70 backdrop-blur-2xl border border-white/50 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 overflow-hidden grid grid-cols-1 md:grid-cols-2 relative z-10"
      >
        {/* Left Panel: Info - Enhanced Gradient */}
        <div className="relative p-10 md:p-14 bg-gradient-to-br from-indigo-50/80 via-white/50 to-emerald-50/80 md:border-r border-slate-100/50 flex flex-col justify-center">
          {/* Mobile Logout Button */}
          <button
            onClick={handleLogout}
            className="md:hidden absolute top-4 right-4 flex items-center gap-2 text-slate-500 hover:text-black transition-colors bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm text-xs border border-slate-100"
          >
            <span>Logout</span>
            <LogOut className="w-3.5 h-3.5" />
          </button>

          <div className="mb-10 relative">
            <div className="absolute -top-6 -left-6 w-20 h-20 bg-indigo-100/50 rounded-full blur-xl animate-pulse"></div>
            <div className="relative w-16 h-16 bg-white rounded-2xl shadow-xl shadow-indigo-100/50 ring-1 ring-slate-50 flex items-center justify-center mb-8">
              <Rocket className="w-8 h-8 text-indigo-600" />
            </div>

            <p className="text-indigo-600 text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-8 h-[1px] bg-indigo-600/30"></span>
              Onboarding
            </p>
            <h1 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6 leading-[1.1] tracking-tight">
              Create your <br />
              <span className="bg-gradient-to-r from-indigo-600 to-emerald-500 bg-clip-text text-transparent">first store</span>
            </h1>
            <p className="text-slate-600 text-base leading-relaxed md:pr-8">
              Welcome to SynapStore. Set up your digital storefront in minutes and start managing your inventory, suppliers, and orders from a premium unified dashboard.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/60 border border-white/80 shadow-sm backdrop-blur-sm hover:scale-[1.02] transition-transform duration-300">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 text-indigo-700 font-bold text-sm">1</div>
              <p className="text-sm font-medium text-slate-700">Role assigned automatically</p>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/60 border border-white/80 shadow-sm backdrop-blur-sm hover:scale-[1.02] transition-transform duration-300 delay-75">
              <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center shrink-0 text-emerald-700 font-bold text-sm">2</div>
              <p className="text-sm font-medium text-slate-700">Configure settings later</p>
            </div>
          </div>
        </div>

        {/* Right Panel: Form - Enhanced Inputs */}
        <div className="p-10 md:p-14 bg-white/30 flex flex-col justify-center backdrop-blur-sm relative">
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
                  <div className="text-sm rounded-2xl border border-red-100 bg-red-50/80 text-red-600 px-5 py-4 flex items-center gap-3 shadow-sm backdrop-blur-sm">
                    <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 shadow-lg shadow-red-500/30" />
                    <span className="font-medium">{error}</span>
                  </div>
                )}
                {success && (
                  <div className="text-sm rounded-2xl border border-emerald-100 bg-black/80 text-emerald-600 px-5 py-4 flex items-center gap-3 shadow-sm backdrop-blur-sm">
                    <span className="w-2 h-2 rounded-full bg-black shrink-0 shadow-lg shadow-emerald-500/30" />
                    <span className="font-medium">{success}</span>
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
                className="space-y-8"
              >
                <div>
                  <h2 className="text-3xl font-bold text-slate-800 tracking-tight">
                    Choose your path
                  </h2>
                  <p className="text-slate-500 mt-2 text-lg">How would you like to use SynapStore?</p>
                </div>

                <div className="grid grid-cols-1 gap-5">
                  <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedRole("STORE_OWNER")}
                    className="group relative w-full p-1 rounded-3xl bg-gradient-to-br from-indigo-100 via-white to-purple-100 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300"
                  >
                    <div className="relative bg-white/60 backdrop-blur-xl rounded-[1.3rem] p-6 text-left border border-white/50 flex items-center gap-6 overflow-hidden">
                      <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors" />

                      <div className="relative z-10 w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform duration-300">
                        <Building2 className="w-8 h-8 text-white" />
                      </div>

                      <div className="relative z-10 flex-1">
                        <h3 className="text-xl font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">Store Owner</h3>
                        <p className="text-slate-500 text-sm font-medium mt-1">Manage inventory, sales & staff</p>
                      </div>

                      <div className="relative z-10 w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors group-hover:translate-x-1 duration-300">
                        <ArrowRight className="w-5 h-5 text-indigo-600" />
                      </div>
                    </div>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedRole("SUPPLIER")}
                    className="group relative w-full p-1 rounded-3xl bg-gradient-to-br from-blue-100 via-white to-cyan-100 shadow-sm hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300"
                  >
                    <div className="relative bg-white/60 backdrop-blur-xl rounded-[1.3rem] p-6 text-left border border-white/50 flex items-center gap-6 overflow-hidden">
                      <div className="absolute right-0 top-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors" />

                      <div className="relative z-10 w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform duration-300">
                        <Truck className="w-8 h-8 text-white" />
                      </div>

                      <div className="relative z-10 flex-1">
                        <h3 className="text-xl font-bold text-slate-800 group-hover:text-blue-700 transition-colors">Supplier</h3>
                        <p className="text-slate-500 text-sm font-medium mt-1">Distribute products to stores</p>
                      </div>

                      <div className="relative z-10 w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors group-hover:translate-x-1 duration-300">
                        <ArrowRight className="w-5 h-5 text-blue-600" />
                      </div>
                    </div>
                  </motion.button>
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
                <div className="w-20 h-20 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <Truck className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-3">
                  Become a Supplier
                </h2>
                <p className="text-slate-500 text-sm mb-8 leading-relaxed max-w-sm mx-auto">
                  We are manually onboarding premium suppliers. Please contact our support team to get verified and listed.
                </p>
                <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 mb-8 border border-white shadow-sm">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-2">Contact Support</p>
                  <a href="mailto:contact@synapstore.me" className="text-lg text-indigo-600 font-bold hover:underline">
                    contact@synapstore.me
                  </a>
                </div>
                <button
                  onClick={() => setSelectedRole(null)}
                  className="text-slate-500 hover:text-slate-800 text-sm font-bold bg-white/50 px-4 py-2 rounded-lg hover:bg-white transition-all"
                >
                  ← Back to selection
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="store-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <form onSubmit={createStore} className="space-y-6">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-2xl font-bold text-slate-800">
                      Store Details
                    </h2>
                    <button
                      type="button"
                      onClick={() => setSelectedRole(null)}
                      className="text-xs font-bold text-slate-400 hover:text-black bg-slate-50 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-all"
                    >
                      Change Role
                    </button>
                  </div>

                  <div className="space-y-5">
                    <div className="group">
                      <label className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-2 ml-1">
                        Store Name
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => handleNameChange(e.target.value)}
                        className="w-full px-5 py-3.5 bg-white/80 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium shadow-sm"
                        placeholder="e.g. Sunrise Pharmacy"
                        disabled={loading}
                        autoFocus
                      />
                    </div>

                    <div className="group">
                      <div className="flex justify-start gap-2 mb-2 ml-1">
                        <label className="text-slate-700 text-xs font-bold uppercase tracking-wider">
                          Store Slug
                        </label>
                        <span className="text-[10px] text-slate-400 py-0.5 bg-slate-100 px-1.5 rounded border border-slate-200 font-medium">URL Safe</span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={slug}
                          onChange={(e) => setSlug(e.target.value)}
                          className={`w-full px-5 py-3.5 bg-slate-50/50 border rounded-xl text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-4 transition-all font-mono text-sm shadow-inner pr-12 ${
                            slugStatus === 'available' ? 'border-emerald-200 focus:ring-emerald-500/10 focus:border-emerald-500' :
                            slugStatus === 'taken' ? 'border-red-200 focus:ring-red-500/10 focus:border-red-500' :
                            'border-slate-200 focus:ring-indigo-500/10 focus:border-indigo-500'
                          }`}
                          placeholder="e.g. sunrise-pharmacy"
                          disabled={loading}
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
                          {slugStatus === 'checking' && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
                          {slugStatus === 'available' && <Check className="w-4 h-4 text-emerald-500" />}
                          {slugStatus === 'taken' && <AlertCircle className="w-4 h-4 text-red-500" />}
                        </div>
                      </div>
                      {slugStatus === 'taken' && (
                        <p className="text-[10px] text-red-500 font-bold mt-1.5 ml-1">This slug is already taken. Try another one.</p>
                      )}
                      {slugStatus === 'available' && (
                        <p className="text-[10px] text-emerald-600 font-bold mt-1.5 ml-1">Perfect! This slug is available.</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <div className="group opacity-70">
                        <label className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-2 ml-1">
                          Timezone
                        </label>
                        <input
                          type="text"
                          value="Asia/Kolkata"
                          readOnly
                          className="w-full px-5 py-3.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-medium focus:outline-none cursor-not-allowed text-sm"
                        />
                      </div>

                      <div className="group opacity-70">
                        <label className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-2 ml-1">
                          Currency
                        </label>
                        <input
                          type="text"
                          value="INR (₹)"
                          readOnly
                          className="w-full px-5 py-3.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-medium focus:outline-none cursor-not-allowed text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={loading || slugStatus === 'checking' || slugStatus === 'taken' || !name.trim() || !slug.trim()}
                      className="w-full !bg-black !text-white py-4 rounded-xl font-bold text-sm shadow-xl shadow-black/20 hover:shadow-2xl hover:shadow-black/40 hover:-translate-y-0.5 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3 group relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                      {loading ? (
                        <Loader2 className="animate-spin w-5 h-5 relative z-10" />
                      ) : (
                        <>
                          <span className="relative z-10">Launch Store</span>
                          <Rocket className="w-5 h-5 group-hover:rotate-12 transition-transform relative z-10" />
                        </>
                      )}
                    </button>
                    <p className="text-center text-xs text-slate-400 mt-4">By creating a store, you agree to our Terms & Conditions.</p>
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
