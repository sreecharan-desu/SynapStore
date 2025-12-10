import React, { useEffect, useState } from "react";
import { useRecoilValue, useSetRecoilState } from "recoil";
import { authState, clearAuthState } from "../state/auth";
import { motion, AnimatePresence } from "framer-motion";
import {
    Package, TruckIcon, FileText, DollarSign,
    Search, Send, Clock, CheckCircle, XCircle,
    LogOut, AlertCircle,
    Store as StoreIcon
} from "lucide-react";
import { Button } from "../components/ui/button";
import { useNavigate } from "react-router-dom";
import { suppliersApi } from "../lib/api/endpoints";
import type { Store, SupplierRequest } from "../lib/types";

// --- Components ---

const StatCard = ({ icon: Icon, label, value, color, delay }: any) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all"
    >
        <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center shadow-inner`}>
                <Icon className="w-6 h-6 text-white" />
            </div>
            <div className="text-right">
                <p className="text-2xl font-bold text-slate-800">{value}</p>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
            </div>
        </div>
    </motion.div>
);

const RequestBadge = ({ status }: { status: string }) => {
    switch (status) {
        case "ACCEPTED":
            return <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold border border-emerald-200"><CheckCircle className="w-3.5 h-3.5" /> Connected</div>;
        case "REJECTED":
            return <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold border border-red-200"><XCircle className="w-3.5 h-3.5" /> Rejected</div>;
        default:
            return <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold border border-amber-200"><Clock className="w-3.5 h-3.5" /> Pending</div>;
    }
};

// --- Main Component ---

const SupplierDashboard: React.FC = () => {
    const auth = useRecoilValue(authState);
    const setAuth = useSetRecoilState(authState);
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<"dashboard" | "marketplace" | "requests" | "profile">("dashboard");
    const [loading, setLoading] = useState(false);

    // Data
    const [stores, setStores] = useState<Store[]>([]);
    const [requests, setRequests] = useState<SupplierRequest[]>([]);

    // Profile form state
    const [profileForm, setProfileForm] = useState({
        name: "",
        contactName: "",
        phone: "",
        address: "",
        defaultLeadTime: 0,
        defaultMOQ: 0
    });

    // Check if we have an existing profile to load
    useEffect(() => {
        if (auth.suppliers && auth.suppliers.length > 0) {
            const s = auth.suppliers[0];
            setProfileForm(prev => ({ ...prev, name: s.name }));
            // We'd ideally fetch the full details here if they aren't in auth state
        }
    }, [auth.suppliers]);

    // Forms
    const [requestMessage, setRequestMessage] = useState("");
    const [selectedStore, setSelectedStore] = useState<Store | null>(null);

    const currentSupplier = auth.suppliers && auth.suppliers.length > 0 ? auth.suppliers[0] : null;

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === "marketplace") {
                const res = await suppliersApi.getDiscoveryStores();
                if (res.data.success) setStores(res.data.data.stores);
            } else if (activeTab === "requests") {
                const res = await suppliersApi.getDetails(currentSupplier?.id);
                if (res.data.success) setRequests(res.data.data.requests);
            } else if (activeTab === "profile") {
                // If we implemented an endpoint to get full profile details, we'd call it here
            }
        } catch (err) {
            console.error("Fetch error", err);
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!currentSupplier) {
            alert("You must create a Supplier Profile first! Go to the 'Profile' tab.");
            return;
        }

        if (!selectedStore) return;

        try {
            const res = await suppliersApi.createRequest({
                storeId: selectedStore.id,
                supplierId: currentSupplier.id,
                message: requestMessage
            });
            if (res.data.success) {
                alert("Request sent successfully!");
                setSelectedStore(null);
                setRequestMessage("");
                setActiveTab("requests");
            } else {
                alert("Failed to send request: Unknown error");
            }
        } catch (err: any) {
            alert("Error: " + err.message);
        }
    };

    const handleSaveProfile = async () => {
        try {
            if (!profileForm.name.trim()) {
                alert("Business Name is required");
                return;
            }

            const res = await suppliersApi.createGlobal({
                name: profileForm.name,
                contactName: profileForm.contactName,
                phone: profileForm.phone,
                address: profileForm.address,
                defaultLeadTime: Number(profileForm.defaultLeadTime),
                defaultMOQ: Number(profileForm.defaultMOQ)
            });

            if (res.data.success) {
                alert("Profile saved successfully!");
                const supData = res.data.data.supplier;
                if (!currentSupplier) {
                    const newSupplierShort = {
                        id: supData.id,
                        storeId: null, // global supplier
                        name: supData.name,
                        isActive: true
                    };
                    setAuth(prev => ({
                        ...prev,
                        suppliers: [newSupplierShort]
                    }));
                }
            } else {
                alert("Failed to save profile: Unknown error");
            }
        } catch (err: any) {
            alert("Error saving profile: " + err.message);
        }
    };

    const handleLogout = () => {
        if (confirm("Are you sure you want to logout?")) {
            setAuth(clearAuthState());
            navigate("/login");
        }
    };

    const pendingCount = requests.filter(r => r.status === "PENDING").length;
    const connectedCount = requests.filter(r => r.status === "ACCEPTED").length;

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex">
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Header */}
                <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200 z-20 shrink-0">
                    <div className="max-w-7xl mx-auto px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-gradient-to-tr from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                    <TruckIcon className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                                        Supplier Portal
                                    </h1>
                                    <p className="text-xs text-slate-500 font-medium">
                                        {currentSupplier ? currentSupplier.name : "Setup Required"}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <nav className="hidden md:flex gap-1">
                                    {(["dashboard", "marketplace", "requests", "profile"] as const).map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab)}
                                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === tab
                                                ? "bg-slate-100 text-slate-900"
                                                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                                                }`}
                                        >
                                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                        </button>
                                    ))}
                                </nav>
                                <div className="h-6 w-[1px] bg-slate-200 mx-2" />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleLogout}
                                    className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                                >
                                    <LogOut className="w-5 h-5" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Content */}
                <main className="flex-1 overflow-y-auto bg-[#F8FAFC] p-6">
                    <div className="max-w-7xl mx-auto">
                        <AnimatePresence mode="wait">

                            {/* DASHBOARD TAB */}
                            {activeTab === "dashboard" && (
                                <motion.div
                                    key="dashboard"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    {!currentSupplier && (
                                        <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                                            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                                            <div>
                                                <h3 className="font-semibold text-amber-800">Complete Your Profile</h3>
                                                <p className="text-sm text-amber-600 mt-1">
                                                    You need to set up your supplier profile before you can connect with stores.
                                                    Go to the <b>Profile</b> tab to get started.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                                        <StatCard
                                            icon={FileText}
                                            label="My Request Status"
                                            value={connectedCount + " / " + (pendingCount + connectedCount)}
                                            color="from-blue-500 to-indigo-500"
                                            delay={0}
                                        />
                                        <StatCard
                                            icon={Package}
                                            label="Active Products"
                                            value="--"
                                            color="from-emerald-500 to-teal-500"
                                            delay={0.1}
                                        />
                                        <StatCard
                                            icon={Clock}
                                            label="Pending Actions"
                                            value={pendingCount}
                                            color="from-orange-500 to-amber-500"
                                            delay={0.2}
                                        />
                                        <StatCard
                                            icon={DollarSign}
                                            label="Revenue (MTD)"
                                            value="$0.00"
                                            color="from-purple-500 to-pink-500"
                                            delay={0.3}
                                        />
                                    </div>
                                </motion.div>
                            )}

                            {/* MARKETPLACE TAB */}
                            {activeTab === "marketplace" && (
                                <motion.div
                                    key="marketplace"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-6"
                                >
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <h2 className="text-2xl font-bold text-slate-800">Marketplace</h2>
                                            <p className="text-slate-500">Discover stores and expand your network.</p>
                                        </div>
                                        <div className="relative">
                                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="Search stores..."
                                                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                            />
                                        </div>
                                    </div>

                                    {loading ? (
                                        <div className="text-center py-12 text-slate-400">Loading marketplace...</div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {stores.map(store => (
                                                <div key={store.id} className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-lg transition-all group relative overflow-hidden">
                                                    <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
                                                        <StoreIcon className="w-12 h-12 text-slate-100 group-hover:text-emerald-50 group-hover:scale-110 transition-transform duration-500" />
                                                    </div>

                                                    <div className="relative z-10">
                                                        <h3 className="text-lg font-bold text-slate-800">{store.name}</h3>
                                                        <p className="text-sm text-slate-500 font-mono mt-1 bg-slate-100 w-fit px-2 py-0.5 rounded text-xs">{store.slug}</p>

                                                        <div className="mt-6 flex flex-wrap gap-2 text-xs text-slate-500">
                                                            <span className="bg-slate-50 px-2 py-1 rounded border border-slate-100">{store.currency}</span>
                                                            <span className="bg-slate-50 px-2 py-1 rounded border border-slate-100">{store.timezone}</span>
                                                        </div>

                                                        <Button
                                                            className="w-full mt-6 bg-slate-900 text-white hover:bg-emerald-600 transition-colors"
                                                            onClick={() => setSelectedStore(store)}
                                                        >
                                                            Connect
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                            {stores.length === 0 && (
                                                <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                                                    No active stores found for discovery.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {/* REQUESTS TAB */}
                            {activeTab === "requests" && (
                                <motion.div
                                    key="requests"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.2 }}
                                    className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                                >
                                    <div className="p-6 border-b border-slate-100">
                                        <h2 className="text-lg font-bold text-slate-800">Sent Requests</h2>
                                        <p className="text-sm text-slate-500">Track the status of your connection requests.</p>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-slate-50 border-b border-slate-200">
                                                <tr>
                                                    <th className="px-6 py-4 font-semibold text-slate-700">Store</th>
                                                    <th className="px-6 py-4 font-semibold text-slate-700">Date Sent</th>
                                                    <th className="px-6 py-4 font-semibold text-slate-700">Message</th>
                                                    <th className="px-6 py-4 font-semibold text-slate-700">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {requests.map(req => (
                                                    <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-6 py-4 font-medium text-slate-900">
                                                            {req.store?.name || (stores.find(s => s.id === req.storeId)?.name) || "Store (" + (req.storeId?.slice(0, 8) || "Unknown") + ")"}
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-500">{req.createdAt ? new Date(req.createdAt).toLocaleDateString() : "-"}</td>
                                                        <td className="px-6 py-4 text-slate-500 max-w-xs truncate" title={req.message || ""}>{req.message || "-"}</td>
                                                        <td className="px-6 py-4">
                                                            <RequestBadge status={req.status} />
                                                        </td>
                                                    </tr>
                                                ))}
                                                {!loading && requests.length === 0 && (
                                                    <tr>
                                                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                                                            No requests sent yet.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </motion.div>
                            )}

                            {/* PROFILE TAB */}
                            {activeTab === "profile" && (
                                <motion.div
                                    key="profile"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.2 }}
                                    className="max-w-2xl mx-auto"
                                >
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
                                        <div className="flex items-center gap-4 mb-8">
                                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-3xl">
                                                👨‍💼
                                            </div>
                                            <div>
                                                <h2 className="text-xl font-bold text-slate-800">Supplier Profile</h2>
                                                <p className="text-sm text-slate-500">Manage your business details.</p>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-2">Business Name</label>
                                                <input
                                                    value={profileForm.name}
                                                    onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                                    placeholder="Enter your business name"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-2">Lead Time (Days)</label>
                                                    <input
                                                        type="number"
                                                        value={profileForm.defaultLeadTime}
                                                        onChange={e => setProfileForm({ ...profileForm, defaultLeadTime: parseInt(e.target.value) || 0 })}
                                                        className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-2">Min. Order Qty</label>
                                                    <input
                                                        type="number"
                                                        value={profileForm.defaultMOQ}
                                                        onChange={e => setProfileForm({ ...profileForm, defaultMOQ: parseInt(e.target.value) || 0 })}
                                                        className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-2">Contact Name</label>
                                                <input
                                                    type="text"
                                                    value={profileForm.contactName}
                                                    onChange={e => setProfileForm({ ...profileForm, contactName: e.target.value })}
                                                    placeholder="Your Name"
                                                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                                />
                                            </div>

                                            <Button onClick={handleSaveProfile} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-6 text-lg rounded-xl">
                                                Save Changes
                                            </Button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                        </AnimatePresence>
                    </div>
                </main>

                {/* Connection Request Modal */}
                {selectedStore && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 overflow-hidden"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">Connect with {selectedStore.name}</h3>
                                    <p className="text-sm text-slate-500">Send a request to start supplying this store.</p>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedStore(null)}><XCircle className="w-5 h-5 text-slate-400" /></Button>
                            </div>

                            <form onSubmit={handleConnect}>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Message (Optional)</label>
                                    <textarea
                                        rows={4}
                                        value={requestMessage}
                                        onChange={e => setRequestMessage(e.target.value)}
                                        placeholder="Hi, we'd like to supply widgets to your store..."
                                        className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                                    />
                                </div>

                                <div className="flex justify-end gap-3">
                                    <Button type="button" variant="secondary" onClick={() => setSelectedStore(null)}>Cancel</Button>
                                    <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                                        <Send className="w-4 h-4" /> Send Request
                                    </Button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default SupplierDashboard;