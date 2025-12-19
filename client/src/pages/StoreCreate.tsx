import { LogOut, Loader2, Building2, Truck, Rocket, ArrowRight, Check, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRecoilState } from "recoil";
import { authState } from "../state/auth";
import { jsonFetch } from "../utils/api";

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

import { DottedSurface } from "../components/ui/dotted-surface";

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
          settings: { theme: "green", avatar: "fruit-strawberry" }, // Passing default theme and avatar
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
    <div className="min-h-screen flex items-center justify-center bg-white p-6 font-sans relative overflow-hidden">
      <DottedSurface className="z-0 opacity-60" />

      {/* Logout Button - Top Right Fixed */}
      <button
        onClick={handleLogout}
        className="absolute top-8 right-8 z-20 bg-[#45a089] hover:bg-[#347966] hover:scale-105 active:scale-95 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg shadow-[#45a089]/20 transition-all duration-300"
      >
        <span>Logout</span>
        <LogOut className="w-3 h-3" />
      </button>

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-0 bg-white/80 backdrop-blur-xl border border-white/50 rounded-[32px] overflow-hidden shadow-2xl shadow-slate-200/50 relative z-10 min-h-[450px]">

        {/* Left Panel: Information */}
        <div className="p-10 md:p-12 flex flex-col justify-center bg-gradient-to-br from-white via-slate-50/30 to-white">
          <div className="mb-8">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-5 shadow-sm ring-1 ring-emerald-100/50">
              <Rocket className="w-6 h-6 text-[#45a089]" />
            </div>

            <p className="text-[#45a089] text-[10px] font-extrabold tracking-[0.2em] uppercase mb-3 opacity-90">
              ONBOARDING
            </p>

            <h1 className="text-[32px] leading-tight font-bold text-slate-900 mb-4 tracking-tight">
              Create your <span className="text-[#45a089]">first store</span>
            </h1>

            <p className="text-slate-500 text-xs leading-relaxed max-w-xs font-medium">
              We noticed you don't have an active store yet. Set up your first store to start managing inventory, suppliers, and orders from a single unified dashboard.
            </p>
          </div>

          <div className="space-y-3 max-w-xs">
            <div className="flex items-center gap-4 p-3 rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-300">
              <span className="w-6 h-6 rounded-full bg-[#dcfce7] text-[#166534] flex items-center justify-center text-[10px] font-bold shrink-0 shadow-inner">1</span>
              <div>
                <p className="text-[11px] font-semibold text-slate-600 leading-snug">Store owner role is assigned automatically to your account.</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-3 rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-300">
              <span className="w-6 h-6 rounded-full bg-[#dcfce7] text-[#166534] flex items-center justify-center text-[10px] font-bold shrink-0 shadow-inner">2</span>
              <div>
                <p className="text-[11px] font-semibold text-slate-600 leading-snug">You can update timezone and currency settings anytime later.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Actions/Form */}
        <div className="p-10 md:p-12 border-l border-slate-100/50 flex flex-col justify-center bg-white/50">

          {/* Status Messages */}
          {(error || success) && (
            <div className="mb-6 animate-in slide-in-from-top-2 duration-300">
              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-600 font-medium flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {success}
                </div>
              )}
            </div>
          )}

          {/* Main Content Area */}
          {selectedRole === null ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">How do you want to get started?</h2>
              </div>

              <div className="grid gap-4">
                <button
                  onClick={() => setSelectedRole("STORE_OWNER")}
                  className="group w-full p-3 rounded-2xl bg-white border-2 border-slate-100 hover:border-[#45a089] hover:bg-slate-50 transition-all duration-300 text-left flex items-center gap-4 shadow-sm hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-300">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-800 text-base group-hover:text-[#45a089] transition-colors">I want to be a Store Owner</h3>
                    <p className="text-slate-500 text-[11px] mt-0.5 font-medium group-hover:text-slate-600">Manage inventory, sales, and staff</p>
                  </div>
                  <div className="pr-2">
                    <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-[#45a089] transition-colors" />
                  </div>
                </button>

                <button
                  onClick={() => setSelectedRole("SUPPLIER")}
                  className="group w-full p-3 rounded-2xl bg-white border-2 border-slate-100 hover:border-[#45a089] hover:bg-slate-50 transition-all duration-300 text-left flex items-center gap-4 shadow-sm hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600 shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-300">
                    <Truck className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-800 text-base group-hover:text-[#45a089] transition-colors">I want to be a Supplier</h3>
                    <p className="text-slate-500 text-[11px] mt-0.5 font-medium group-hover:text-slate-600">Supply products to stores</p>
                  </div>
                  <div className="pr-2">
                    <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-[#45a089] transition-colors" />
                  </div>
                </button>
              </div>
            </div>
          ) : selectedRole === "SUPPLIER" ? (
            <div className="text-center py-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="w-20 h-20 bg-[#f0fdf4] rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner ring-1 ring-emerald-100">
                <Truck className="w-10 h-10 text-[#45a089]" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Become a Supplier</h2>
              <p className="text-slate-500 text-xs mb-6 leading-relaxed max-w-xs mx-auto font-medium">
                We are manually onboarding premium suppliers. Please contact our support team to get verified and listed.
              </p>
              <div className="p-4 bg-slate-50/80 rounded-xl mb-6 border border-slate-100/60">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Email Support</p>
                <a href="mailto:contact@synapstore.me" className="text-lg text-[#45a089] font-bold hover:underline">
                  contact@synapstore.me
                </a>
              </div>
              <button
                onClick={() => setSelectedRole(null)}
                className="text-slate-400 hover:text-slate-800 text-[10px] font-bold transition-colors flex items-center justify-center gap-2 mx-auto uppercase tracking-wider bg-white px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              >
                ← Back to selection
              </button>
            </div>
          ) : (
            <form onSubmit={createStore} className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Store Details
                </h2>
                <button
                  type="button"
                  onClick={() => setSelectedRole(null)}
                  className="text-[10px] font-bold text-slate-500 hover:text-[#45a089] bg-slate-100 px-2.5 py-1 rounded-lg hover:bg-emerald-50 transition-all border border-transparent hover:border-emerald-200"
                >
                  Change Role
                </button>
              </div>

              <div className="space-y-4">
                <div className="relative group">
                  <label className="block text-slate-700 text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1">
                    Store Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#45a089] focus:ring-4 focus:ring-[#45a089]/10 transition-all text-sm font-semibold shadow-sm group-hover:border-slate-200"
                    placeholder="e.g. Sunrise Pharmacy"
                    disabled={loading}
                    autoFocus
                  />
                </div>

                <div className="relative group">
                  <label className="block text-slate-700 text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1">
                    Store Slug
                  </label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50/50 border-2 border-slate-100 rounded-xl text-slate-600 placeholder:text-slate-400 focus:outline-none focus:border-[#45a089] focus:bg-white transition-all text-sm font-mono shadow-sm group-hover:border-slate-200"
                    placeholder="e.g. sunrise-pharmacy"
                    disabled={loading}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1">
                      Timezone
                    </label>
                    <div className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-slate-500 text-sm font-semibold flex items-center justify-between">
                      Asia/Kolkata
                      <div className="w-2 h-2 rounded-full bg-slate-300" />
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
                  </div>
                  <div>
                    <label className="block text-slate-700 text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1">
                      Currency
                    </label>
                    <div className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-slate-500 text-sm font-semibold flex items-center justify-between">
                      INR (₹)
                      <div className="w-2 h-2 rounded-full bg-slate-300" />
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#45a089] hover:bg-[#347966] text-white py-3.5 rounded-xl font-bold text-sm shadow-xl shadow-[#45a089]/20 hover:shadow-2xl hover:shadow-[#45a089]/30 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed mt-4 active:scale-[0.98]"
              >
                {loading ? (
                  <Loader2 className="animate-spin w-5 h-5" />
                ) : (
                  <>
                    <span>Launch Store</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          )}
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
      </div>
    </div>
  );
};

export default StoreCreate;
