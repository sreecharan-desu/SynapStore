import React, { useEffect, useState } from "react";
import { useRecoilValue, useSetRecoilState } from "recoil";
import { authState, clearAuthState } from "../state/auth";
import { motion, AnimatePresence } from "framer-motion";
import {
    Package, TruckIcon, FileText, DollarSign,
    Search, Send, Clock, CheckCircle, XCircle,
    LogOut, AlertCircle, LayoutGrid, User, ShoppingBag, Inbox, Upload,
    Store as StoreIcon, Phone, MapPin, Building, Download, FileSpreadsheet, RefreshCw, X
} from "lucide-react";
import { Button } from "../components/ui/button";
import { useNavigate } from "react-router-dom";
import { suppliersApi } from "../lib/api/endpoints";
import { SupplierService } from "../lib/api/supplierService";
import type { Store, SupplierRequest } from "../lib/types";
import { Dock, DockIcon, DockItem, DockLabel } from "../components/ui/dock";

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

    // Fix for crash: Redirect immediately if no user and stop rendering the rest
    useEffect(() => {
        if (!auth.token || !auth.user) {
            navigate("/login");
        }
    }, [auth.token, auth.user, navigate]);

    if (!auth.token || !auth.user) {
        return null; // Or a loading spinner
    }

    const [activeTab, setActiveTab] = useState<"dashboard" | "marketplace" | "requests" | "orders" | "my-stores" | "profile" | "upload">("dashboard");
    const [loading, setLoading] = useState(false);

    // Data
    const [stores, setStores] = useState<Store[]>([]);
    const [requests, setRequests] = useState<SupplierRequest[]>([]);
    const [connectedStores, setConnectedStores] = useState<Store[]>([]);

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
    const [searchQuery, setSearchQuery] = useState("");

    const currentSupplier = auth.suppliers && auth.suppliers.length > 0 ? auth.suppliers[0] : null;

    // Fulfill Modal State
    const [fulfillModalOpen, setFulfillModalOpen] = useState(false);
    const [requestToFulfill, setRequestToFulfill] = useState<SupplierRequest | null>(null);
    const [fulfillItems, setFulfillItems] = useState<any[]>([]);
    
    // Helper to open fulfill modal
    const openFulfillModal = (req: SupplierRequest) => {
        if (req.payload?.type === 'REORDER' && req.payload.items) {
             setRequestToFulfill(req);
             // Pre-fill items from request, defaulting quantity to requested
             // We need to allow user to add batch numbers/expiry
             setFulfillItems(req.payload.items.map((i: any) => ({
                 medicineId: i.medicineId,
                 medicineName: i.medicineName || "Unknown Item",
                 quantity: i.quantity,
                 batchNumber: "", // Supplier must input
                 expiryDate: "", 
                 purchasePrice: 0,
                 mrp: 0
             })));
             setFulfillModalOpen(true);
        } else {
            alert("This request does not contain reorder items or is malformed.");
        }
    };

    const handleSubmitFulfillment = async () => {
         if (!requestToFulfill) return;
         try {
             // Validate
             if (fulfillItems.some(i => !i.batchNumber || !i.expiryDate)) {
                 alert("Please provide Batch Number and Expiry Date for all items.");
                 return;
             }

             const res = await suppliersApi.fulfillRequest(requestToFulfill.id, { items: fulfillItems });
             if (res.data.success) {
                 alert("Reorder fulfilled successfully!");
                 setFulfillModalOpen(false);
                 setRequestToFulfill(null);
                 setFulfillItems([]);
                 // Optionally update status logic if backend changed status (it doesn't change from ACCEPTED, but logs it)
             }
         } catch (err: any) {
             console.error(err);
             alert("Failed to fulfill: " + err.message);
         }
    };

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
            } else if (activeTab === "requests" || activeTab === "orders") {
                const res = await suppliersApi.getDetails(currentSupplier?.id);
                if (res.data.success) setRequests(res.data.data.requests);
            } else if (activeTab === "my-stores" || activeTab === "upload") {
                const res = await suppliersApi.getDetails(currentSupplier?.id);
                if (res.data.success) {
                    setConnectedStores(res.data.data.supplier?.supplierStores?.map(s => s.store) || []);
                }
            } else if (activeTab === "profile") {
                if (currentSupplier?.id) {
                    const res = await suppliersApi.getDetails(currentSupplier.id);
                    if (res.data.success && res.data.data.supplier) {
                        const s = res.data.data.supplier;
                        setProfileForm({
                            name: s.name || "",
                            contactName: s.contactName || "",
                            phone: s.phone || "",
                            address: s.address || "",
                            defaultLeadTime: s.defaultLeadTime || 0,
                            defaultMOQ: s.defaultMOQ || 0
                        });
                    }
                }
            }
        } catch (err) {
            console.error("Fetch error", err);
        } finally {
            setLoading(false);
        }
    };

    const handleDisconnectStore = async (storeId: string) => {
        if (!confirm("Are you sure you want to disconnect from this store?")) return;
        try {
            const res = await suppliersApi.disconnectStore(storeId);
            if (res.data.success) {
                setConnectedStores(prev => prev.filter(s => s.id !== storeId));
                alert("Store disconnected successfully.");
            }
        } catch (err) {
            console.error("Failed to disconnect", err);
            alert("Failed to disconnect store");
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
            setLoading(true);
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
        } finally {
            setLoading(false);
        }
    };

    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    const handleLogout = (e?: React.MouseEvent) => {
        e?.preventDefault();
        e?.stopPropagation();
        console.log("Logout clicked");
        setShowLogoutConfirm(true);
    };

    const confirmLogout = () => {
        setAuth(clearAuthState());
        navigate("/login");
    };

    const [pendingAcceptRequestId, setPendingAcceptRequestId] = useState<string | null>(null);

    const handleAcceptRequest = async (requestId: string) => {
        const req = requests.find(r => r.id === requestId);
        
        // If it's a REORDER request, redirect to upload page first
        if (req?.payload?.type === 'REORDER') {
            if (confirm("To accept this order, you must upload the fulfillment data (CSV). Proceed to Upload?")) {
                setPendingAcceptRequestId(requestId);
                const storeToSelect = req.store || connectedStores.find(s => s.id === req.storeId);
                if (storeToSelect) {
                    setSelectedStore(storeToSelect);
                }
                setActiveTab("upload");
            }
            return;
        }

        // Standard Connection Request Accept
        try {
            const res = await suppliersApi.acceptRequest(requestId);
            if (res.data.success) {
                alert("Request accepted!");
                // Optimistic update
                setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: "ACCEPTED" } : r));
                fetchData(); // Refresh to get connection
            }
        } catch (err: any) {
            console.error(err);
            alert("Failed to accept request: " + err.message);
        }
    };

    // ... (rest of code) ...


    const handleRejectRequest = async (requestId: string) => {
        if (!confirm("Are you sure you want to reject this request?")) return;
        try {
            const res = await suppliersApi.rejectRequest(requestId);
            if (res.data.success) {
                alert("Request rejected.");
                setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: "REJECTED" } : r));
            }
        } catch (err: any) {
            console.error(err);
            alert("Failed to reject request: " + err.message);
        }
    };

    // Skeleton Component for Requests
    const RequestSkeleton = () => (
        <div className="space-y-4">
            {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white border border-slate-100 rounded-xl p-4 flex items-center justify-between animate-pulse">
                    <div className="flex items-center gap-4 w-full">
                        <div className="w-12 h-12 bg-slate-100 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-slate-100 rounded w-1/4" />
                            <div className="h-3 bg-slate-50 rounded w-1/3" />
                        </div>
                        <div className="w-20 h-6 bg-slate-100 rounded-full" />
                    </div>
                </div>
            ))}
        </div>
    );



    const pendingCount = requests.filter(r => r.status === "PENDING").length;
    const connectedCount = requests.filter(r => r.status === "ACCEPTED").length;

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col relative">

            {/* Main Content Area - Full Width */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Header */}
                <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200 z-30 shrink-0">
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

                            <div className="relative z-50">
                                <Button
                                    onClick={handleLogout}
                                    className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white border-0 shadow-lg shadow-red-500/30 hover:shadow-red-500/50 rounded-xl px-5 py-2 h-auto text-sm font-semibold transition-all active:scale-95 flex items-center gap-2"
                                >
                                    <LogOut className="w-4 h-4" />
                                    <span>Logout</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Content */}
                <main className="flex-1 overflow-y-auto bg-[#F8FAFC] p-6 pb-32">
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
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                    className="max-w-5xl mx-auto"
                                >
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden min-h-[600px] flex flex-col">
                                        <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div>
                                                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                                                    <Inbox className="w-6 h-6 text-indigo-500" /> Connection Requests
                                                </h2>
                                                <p className="text-slate-500 mt-1">Manage inbound and outbound store partnerships.</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <p

                                                    className="h-10 w-10 flex items-center justify-center bg-white hover:bg-slate-100 text-black rounded-full transition-colors"
                                                    onClick={() => fetchData()}
                                                    title="Refresh requests"
                                                >
                                                    <RefreshCw strokeWidth={2.5} className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                                                </p>
                                                <div className="relative">
                                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                    <input
                                                        type="text"
                                                        placeholder="Search requests..."
                                                        value={searchQuery}
                                                        onChange={(e) => setSearchQuery(e.target.value)}
                                                        className="pl-9 pr-9 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm w-64 transition-all"
                                                    />
                                                    {searchQuery && (
                                                        <p

                                                            onClick={() => setSearchQuery("")}
                                                            className="absolute h-5 w-5 right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full transition-colors !bg-transparent hover:!bg-slate-100"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex-1 p-6 bg-slate-50/30">
                                            {loading ? (
                                                <RequestSkeleton />
                                            ) : (
                                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                                    <table className="w-full text-left text-sm">
                                                        <thead className="bg-slate-50/80 border-b border-slate-200 backdrop-blur-sm">
                                                            <tr>
                                                                <th className="px-6 py-5 font-semibold text-slate-700 uppercase tracking-wider text-xs">Store / Entity</th>
                                                                <th className="px-6 py-5 font-semibold text-slate-700 uppercase tracking-wider text-xs">Direction</th>
                                                                <th className="px-6 py-5 font-semibold text-slate-700 uppercase tracking-wider text-xs">Message</th>
                                                                <th className="px-6 py-5 font-semibold text-slate-700 uppercase tracking-wider text-xs">Date</th>
                                                                <th className="px-6 py-5 font-semibold text-slate-700 uppercase tracking-wider text-xs text-center">Status</th>
                                                                <th className="px-6 py-5 font-semibold text-slate-700 uppercase tracking-wider text-xs text-right">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">

                                                            {(() => {
                                                                const filteredRequests = requests.filter(req => {
                                                                     // EXCLUDE reorders
                                                                     if (req.payload?.type === 'REORDER') return false;

                                                                     if (!searchQuery) return true;
                                                                     const q = searchQuery.toLowerCase();
                                                                     const storeName = req.store?.name || "";
                                                                     const msg = req.message || "";
                                                                     return storeName.toLowerCase().includes(q) || msg.toLowerCase().includes(q) || req.id.toLowerCase().includes(q);
                                                                });

                                                                if (filteredRequests.length === 0) {
                                                                    return (
                                                                        <tr>
                                                                            <td colSpan={6} className="px-6 py-20 text-center">
                                                                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                                                                    <Inbox className="w-8 h-8 text-slate-300" />
                                                                                </div>
                                                                                <h3 className="text-lg font-medium text-slate-900">No Requests Found</h3>
                                                                                <p className="text-slate-500 mt-1 max-w-sm mx-auto">
                                                                                    {searchQuery ? "No requests match your search query." : "You haven't sent or received any connection requests yet. Check the Marketplace to connect with stores."}
                                                                                </p>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                }

                                                                return filteredRequests.map(req => {
                                                                    const isInbound = req.createdById !== auth.user?.id;
                                                                    const storeName = req.store?.name || (stores.find(s => s.id === req.storeId)?.name) || "Store (" + (req.storeId?.slice(0, 8) || "Unknown") + ")";

                                                                    return (
                                                                        <tr key={req.id} className="group hover:bg-indigo-50/30 transition-colors">
                                                                            <td className="px-6 py-4">
                                                                                <div className="flex items-center gap-3">
                                                                                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-600 font-bold border border-indigo-200">
                                                                                        {storeName.charAt(0)}
                                                                                    </div>
                                                                                    <div>
                                                                                        <p className="font-semibold text-slate-900">{storeName}</p>
                                                                                        <p className="text-xs text-slate-500 font-mono">ID: {req.storeId?.slice(0, 6)}...</p>
                                                                                    </div>
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-6 py-4">
                                                                                {isInbound ?
                                                                                    <div className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100 w-fit">
                                                                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                                                                        Incoming
                                                                                    </div>
                                                                                    :
                                                                                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 w-fit">
                                                                                        <Send className="w-3 h-3" /> Outgoing
                                                                                    </div>
                                                                                }
                                                                            </td>
                                                                            <td className="px-6 py-4 max-w-[200px]">
                                                                                <p className="truncate text-slate-500 text-sm" title={req.message || ""}>{req.message || <span className="text-slate-300 italic">No message</span>}</p>
                                                                            </td>
                                                                            <td className="px-6 py-4 text-sm text-slate-500">
                                                                                {req.createdAt ? new Date(req.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : "-"}
                                                                            </td>
                                                                            <td className="px-6 py-4 text-center">
                                                                                <div className="flex justify-center">
                                                                                    <RequestBadge status={req.status} />
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-6 py-4 text-right">
                                                                                {isInbound && req.status === "PENDING" ? (
                                                                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                        <Button
                                                                                            size="sm"
                                                                                            className="h-8 shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                                                                                            onClick={() => handleAcceptRequest(req.id)}
                                                                                        >
                                                                                            Accept
                                                                                        </Button>
                                                                                        <Button
                                                                                            size="sm"
                                                                                            variant="outline"
                                                                                            className="h-8 border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                                                                                            onClick={() => handleRejectRequest(req.id)}
                                                                                        >
                                                                                            Reject
                                                                                        </Button>
                                                                                    </div>
                                                                                ) : (
                                                                                    <span className="text-xs text-slate-400 font-medium">No actions</span>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                });
                                                            })()}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* ORDERS TAB */}
                            {activeTab === "orders" && (
                                <motion.div
                                    key="orders"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                    className="max-w-6xl mx-auto space-y-8"
                                >
                                    {/* Header */}
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200">
                                        <div>
                                            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Orders Management</h2>
                                            <p className="text-slate-500 mt-2 text-lg">Process and fulfill incoming stock requests.</p>
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                                <input 
                                                    type="text" 
                                                    placeholder="Search orders..." 
                                                    value={searchQuery}
                                                    onChange={e => setSearchQuery(e.target.value)}
                                                    className="pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-64 shadow-sm"
                                                />
                                            </div>
                                            <Button variant="outline" onClick={fetchData} className="border-slate-200 bg-white">
                                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Orders List */}
                                    <div className="space-y-6">
                                        {(() => {
                                            const filteredRequests = requests.filter(req => {
                                                // Only show Reorders
                                                if (req.payload?.type !== 'REORDER') return false;

                                                if (!searchQuery) return true;
                                                const q = searchQuery.toLowerCase();
                                                return req.store?.name?.toLowerCase().includes(q) || req.id.toLowerCase().includes(q);
                                            });
                                            return filteredRequests.length === 0 ? (
                                                <div className="bg-white rounded-3xl border border-slate-200 p-20 text-center shadow-sm">
                                                    <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                                        <Package className="w-10 h-10 text-indigo-400" />
                                                    </div>
                                                    <h3 className="text-xl font-bold text-slate-900">No Orders Found</h3>
                                                    <p className="text-slate-500 mt-2">You haven't received any reorder requests yet.</p>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 gap-6">
                                                    {requests.filter(req => req.payload?.type === 'REORDER').map(req => {
                                                        const isPending = req.status === 'PENDING';
                                                        const isAccepted = req.status === 'ACCEPTED';
                                                        
                                                        return (
                                                            <div key={req.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 overflow-hidden group">
                                                                {/* Order Header */}
                                                                <div className="bg-white px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
                                                                     <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                                                                    
                                                                    <div className="flex items-center gap-4 relative z-10">
                                                                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold shadow-sm group-hover:scale-105 transition-transform">
                                                                            {req.store?.name?.[0] || "S"}
                                                                        </div>
                                                                        <div>
                                                                            <h3 className="font-bold text-slate-800 text-lg">{req.store?.name || "Unknown Store"}</h3>
                                                                            <div className="flex items-center gap-3 text-xs text-slate-500 font-medium font-mono mt-1">
                                                                                <span>Order #{req.id.slice(0, 8)}</span>
                                                                                <span className="w-1 h-1 rounded-full bg-slate-300" />
                                                                                <span>{new Date(req.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center gap-3 relative z-10">
                                                                         {/* Payment Badge */}
                                                                         <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100 shadow-sm">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                                            CASH
                                                                        </div>

                                                                        <div className={`px-4 py-1.5 rounded-full text-xs font-bold border flex items-center gap-2 shadow-sm ${
                                                                            isPending ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                                            isAccepted ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                                            'bg-slate-100 text-slate-600 border-slate-200'
                                                                        }`}>
                                                                            {isPending && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                                                                            {isAccepted && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                                                                            {req.status}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Order Body */}
                                                                <div className="p-6 bg-slate-50/30">
                                                                    {/* Note if any */}
                                                                    {req.payload?.note && (
                                                                        <div className="bg-white/50 text-slate-600 text-sm p-4 rounded-xl mb-6 border border-indigo-100 relative pl-4 border-l-4 border-l-indigo-400 shadow-sm">
                                                                            <span className="font-bold text-indigo-500 block text-xs mb-1 uppercase tracking-wider">Note from Store</span>
                                                                            "{req.payload.note}"
                                                                        </div>
                                                                    )}

                                                                    {/* Items List */}
                                                                    <div className="mb-6">
                                                                        <div className="flex items-center justify-between mb-3">
                                                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                                                                <Package className="w-4 h-4" /> Requested Items ({req.payload?.items?.length || 0})
                                                                            </h4>
                                                                             <div className="md:hidden flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-100">
                                                                                CASH
                                                                            </div>
                                                                        </div>
                                                                        
                                                                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                                                            <table className="w-full text-sm text-left">
                                                                                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                                                                                    <tr>
                                                                                        <th className="px-5 py-3 text-xs uppercase tracking-wider">Medicine</th>
                                                                                        <th className="px-5 py-3 text-right text-xs uppercase tracking-wider">Qty</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-slate-100">
                                                                                    {req.payload?.items?.map((item: any, idx: number) => (
                                                                                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                                                                            <td className="px-5 py-3 font-medium text-slate-700 flex items-center gap-3">
                                                                                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                                                                                                    <Package className="w-4 h-4" />
                                                                                                </div>
                                                                                                {item.medicineName || "Unknown Item"}
                                                                                            </td>
                                                                                            <td className="px-5 py-3 text-right text-slate-600 font-mono font-bold">
                                                                                                {item.quantity}
                                                                                            </td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </div>

                                                                    {/* Actions */}
                                                                    <div className="flex justify-end pt-2 gap-3">
                                                                        {isPending ? (
                                                                            <>
                                                                                <Button 
                                                                                    variant="secondary" 
                                                                                    onClick={() => handleRejectRequest(req.id)}
                                                                                    className="bg-white border border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 shadow-sm transition-all"
                                                                                >
                                                                                    Reject
                                                                                </Button>
                                                                                <Button 
                                                                                    onClick={() => handleAcceptRequest(req.id)}
                                                                                    className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-lg shadow-emerald-500/20 border-none px-6 transition-all transform hover:scale-105"
                                                                                >
                                                                                    Accept Request
                                                                                </Button>
                                                                            </>
                                                                        ) : isAccepted ? (
                                                                            <Button 
                                                                                onClick={() => openFulfillModal(req)}
                                                                                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/20 border-none px-6 gap-2 transition-all transform hover:scale-105"
                                                                            >
                                                                                <Package className="w-4 h-4" /> Fulfill Order
                                                                            </Button>
                                                                        ) : (
                                                                            <div className="px-4 py-2 bg-slate-100 text-slate-400 rounded-lg text-sm font-medium italic">
                                                                                {req.status === 'REJECTED' ? 'Rejected' : 'No actions available'}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </motion.div>
                            )}
                            {activeTab === "my-stores" && (
                                <motion.div
                                    key="my-stores"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                    className="max-w-6xl mx-auto"
                                >
                                    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden min-h-[600px] flex flex-col">

                                        {/* Header Section */}
                                        <div className="px-8 py-8 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                            <div>
                                                <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                                                    <StoreIcon className="w-8 h-8 text-blue-600" /> Connected Stores
                                                </h2>
                                                <p className="text-slate-500 mt-2 text-lg">Manage your active partnerships and store integrations.</p>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold border border-blue-100 flex items-center gap-2 shadow-sm">
                                                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                                    {connectedStores.length} Active {connectedStores.length === 1 ? 'Connection' : 'Connections'}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Stores Grid */}
                                        <div className="flex-1 p-8 bg-slate-50/30">
                                            {loading ? (
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                    {[1, 2, 3].map((i) => (
                                                        <div key={i} className="h-48 bg-white border border-slate-100 rounded-2xl shadow-sm animate-pulse" />
                                                    ))}
                                                </div>
                                            ) : connectedStores.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
                                                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                                                        <StoreIcon className="w-10 h-10 text-slate-300" />
                                                    </div>
                                                    <h3 className="text-xl font-bold text-slate-900">No Connected Stores</h3>
                                                    <p className="text-slate-500 mt-2 text-center max-w-md">
                                                        You haven't connected with any stores yet. Visit the Marketplace to send connection requests.
                                                    </p>
                                                    <Button
                                                        onClick={() => setActiveTab("marketplace")}
                                                        className="mt-6 bg-slate-900 text-white hover:bg-slate-800"
                                                    >
                                                        Browse Marketplace
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                    {connectedStores.map(store => (
                                                        <div key={store.id} className="group bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-xl hover:shadow-blue-500/5 hover:border-blue-200 transition-all duration-300 relative overflow-hidden flex flex-col justify-between h-full">

                                                            {/* Decorative Gradient Blob */}
                                                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-colors" />

                                                            <div>
                                                                <div className="flex justify-between items-start mb-4">
                                                                    <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl flex items-center justify-center border border-blue-100 group-hover:scale-110 transition-transform duration-300">
                                                                        <StoreIcon className="w-7 h-7 text-blue-600" />
                                                                    </div>
                                                                    <div className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wide rounded-full border border-emerald-100 flex items-center gap-1.5 shadow-sm">
                                                                        <CheckCircle className="w-3 h-3" /> Live
                                                                    </div>
                                                                </div>

                                                                <h3 className="text-xl font-bold text-slate-800 mb-1 group-hover:text-blue-700 transition-colors">{store.name}</h3>
                                                                <p className="text-sm text-slate-400 font-mono mb-6 flex items-center gap-2">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300" /> {store.slug}
                                                                </p>

                                                                <div className="space-y-3">
                                                                    <div className="flex items-center justify-between text-sm p-3 bg-slate-50 rounded-lg border border-slate-100 group-hover:bg-blue-50/50 group-hover:border-blue-100 transition-colors">
                                                                        <span className="text-slate-500 font-medium">Currency</span>
                                                                        <span className="font-bold text-slate-700">{store.currency || "USD"}</span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between text-sm p-3 bg-slate-50 rounded-lg border border-slate-100 group-hover:bg-blue-50/50 group-hover:border-blue-100 transition-colors">
                                                                        <span className="text-slate-500 font-medium">Timezone</span>
                                                                        <span className="font-bold text-slate-700 truncate max-w-[120px]" title={store.timezone || "UTC"}>{store.timezone || "UTC"}</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="mt-8 pt-6 border-t border-slate-100">
                                                                <Button
                                                                    variant="ghost"
                                                                    className="w-full text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-100 border border-transparent transition-all"
                                                                    onClick={() => handleDisconnectStore(store.id)}
                                                                >
                                                                    <LogOut className="w-4 h-4 mr-2" /> Disconnect Store
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* PROFILE TAB */}
                            {activeTab === "profile" && (
                                <motion.div
                                    key="profile"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    transition={{ duration: 0.3 }}
                                    className="max-w-4xl mx-auto"
                                >
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
                                        {/* Cover Banner */}
                                        <div className="h-32 bg-gradient-to-r from-emerald-600 to-teal-600 relative">
                                            <div className="absolute inset-0 bg-black/10" />
                                            <div className="absolute -bottom-10 left-8">
                                                <div className="w-24 h-24 bg-white p-1 rounded-2xl shadow-lg">
                                                    <div className="w-full h-full bg-slate-100 rounded-xl flex items-center justify-center text-4xl border border-slate-200">
                                                        👨‍💼
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-16 pb-8 px-8">
                                            <div className="flex justify-between items-start mb-8">
                                                <div>
                                                    <h2 className="text-2xl font-bold text-slate-800">Supplier Profile</h2>
                                                    <p className="text-slate-500">Manage your business identity and operational settings.</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                {/* Left Column: Business Info */}
                                                <div className="space-y-6">
                                                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                                        <Building className="w-4 h-4" /> Business Details
                                                    </h3>

                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-2">Business Name</label>
                                                        <div className="relative">
                                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                                <StoreIcon className="w-4 h-4 text-slate-400" />
                                                            </div>
                                                            <input
                                                                value={profileForm.name}
                                                                onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                                                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                                                placeholder="e.g. Acme Supplies Ltd."
                                                            />
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-2">Contact Name</label>
                                                        <div className="relative">
                                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                                <User className="w-4 h-4 text-slate-400" />
                                                            </div>
                                                            <input
                                                                type="text"
                                                                value={profileForm.contactName}
                                                                onChange={e => setProfileForm({ ...profileForm, contactName: e.target.value })}
                                                                placeholder="e.g. John Doe"
                                                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-2">Phone Number</label>
                                                        <div className="relative">
                                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                                <Phone className="w-4 h-4 text-slate-400" />
                                                            </div>
                                                            <input
                                                                type="text"
                                                                value={profileForm.phone}
                                                                onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                                                                placeholder="e.g. +1 (555) 000-0000"
                                                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right Column: Operations & Address */}
                                                <div className="space-y-6">
                                                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                                        <Package className="w-4 h-4" /> Operations & Location
                                                    </h3>

                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
                                                        <div className="relative">
                                                            <div className="absolute top-3 left-3 flex items-start pointer-events-none">
                                                                <MapPin className="w-4 h-4 text-slate-400" />
                                                            </div>
                                                            <textarea
                                                                value={profileForm.address}
                                                                onChange={e => setProfileForm({ ...profileForm, address: e.target.value })}
                                                                placeholder="e.g. 123 Industrial Park, Tech City"
                                                                rows={3}
                                                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-sm font-medium text-slate-700 mb-2">Lead Time (Days)</label>
                                                            <div className="relative">
                                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                                    <Clock className="w-4 h-4 text-slate-400" />
                                                                </div>
                                                                <input
                                                                    type="number"
                                                                    value={profileForm.defaultLeadTime}
                                                                    onChange={e => setProfileForm({ ...profileForm, defaultLeadTime: parseInt(e.target.value) || 0 })}
                                                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium text-slate-700 mb-2">Min. Order Qty</label>
                                                            <div className="relative">
                                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                                    <Package className="w-4 h-4 text-slate-400" />
                                                                </div>
                                                                <input
                                                                    type="number"
                                                                    value={profileForm.defaultMOQ}
                                                                    onChange={e => setProfileForm({ ...profileForm, defaultMOQ: parseInt(e.target.value) || 0 })}
                                                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-10 pt-6 border-t border-slate-100 flex justify-end">
                                                <Button
                                                    onClick={handleSaveProfile}
                                                    disabled={loading}
                                                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/30 px-8 py-6 text-lg rounded-xl transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                                                >
                                                    {loading ? (
                                                        <>
                                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                                            Saving...
                                                        </>
                                                    ) : (
                                                        "Save Profile Changes"
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* UPLOAD TAB */}
                            {activeTab === "upload" && (
                                <motion.div
                                    key="upload"
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.98 }}
                                    transition={{ duration: 0.3 }}
                                    className="max-w-6xl mx-auto pb-20"
                                >
                                    <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
                                        {/* Cinematic Header Banner */}
                                        <div className="bg-gradient-to-br from-indigo-700 via-blue-600 to-sky-500 min-h-[200px] relative overflow-hidden flex items-center p-12">
                                            <div className="relative z-10 max-w-2xl">
                                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/90 text-sm font-medium mb-4 backdrop-blur-sm">
                                                    <Upload className="w-4 h-4" /> Bulk Inventory System
                                                </div>
                                                <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
                                                    Upload Inventory
                                                </h2>
                                                <p className="text-lg text-blue-100 mt-4 leading-relaxed max-w-xl">
                                                    Seamlessly update your product catalog in bulk.
                                                    Follow the steps to ensure perfect data synchronization.
                                                </p>
                                            </div>

                                            {/* Decorative Background Elements */}
                                            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3" />
                                            <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-indigo-900/40 rounded-full blur-[80px] translate-y-1/3 -translate-x-1/3" />
                                            <FileSpreadsheet className="absolute right-12 bottom-0 w-64 h-64 text-white/5 rotate-12 translate-y-20 transform" />
                                        </div>

                                        <div className="p-10 bg-slate-50/50">
                                            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

                                                {/* LEFT COLUMN - CONTROLS (Steps 1 & 2) */}
                                                <div className="xl:col-span-5 space-y-8">

                                                    {/* Step 1 Card */}
                                                    <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300">
                                                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                                            <div className="text-8xl font-bold text-slate-900 leading-none -mt-4 -mr-4">1</div>
                                                        </div>
                                                        <div className="relative z-10">
                                                            <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-6">
                                                                <StoreIcon className="w-6 h-6" />
                                                            </div>
                                                            <h3 className="text-xl font-bold text-slate-800 mb-2">Select Target Store</h3>
                                                            <p className="text-slate-500 mb-6">Choose the destination store for this dataset.</p>

                                                            {loading && connectedStores.length === 0 ? (
                                                                <div className="h-12 w-full bg-slate-100 animate-pulse rounded-xl" />
                                                            ) : connectedStores.length === 0 ? (
                                                                <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm font-medium">
                                                                    No stores details found. Please check connections.
                                                                </div>
                                                            ) : (
                                                                <div className="relative group/select">
                                                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                                        <StoreIcon className="w-5 h-5 text-indigo-500" />
                                                                    </div>
                                                                    <select
                                                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-base font-medium text-slate-700 transition-all cursor-pointer appearance-none"
                                                                        value={selectedStore?.id || ""}
                                                                        onChange={(e) => {
                                                                            const s = connectedStores.find(st => st.id === e.target.value);
                                                                            setSelectedStore(s || null);
                                                                        }}
                                                                    >
                                                                        <option value="">-- Choose a Store --</option>
                                                                        {connectedStores.map(store => (
                                                                            <option key={store.id} value={store.id}>
                                                                                {store.name} — {store.currency}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                    {/* Custom arrow */}
                                                                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Step 2 Card */}
                                                    <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300">
                                                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                                            <div className="text-8xl font-bold text-slate-900 leading-none -mt-4 -mr-4">2</div>
                                                        </div>
                                                        <div className="relative z-10">
                                                            <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center mb-6">
                                                                <FileSpreadsheet className="w-6 h-6" />
                                                            </div>
                                                            <h3 className="text-xl font-bold text-slate-800 mb-2">Prepare Data</h3>
                                                            <p className="text-slate-500 mb-6">Ensure your data matches our improved CSV format.</p>

                                                            <Button
                                                                variant="outline"
                                                                onClick={() => SupplierService.downloadTemplate()}
                                                                className="w-full py-6 text-lg border-2 border-slate-200 text-slate-600 hover:border-teal-500 hover:text-teal-600 hover:bg-teal-50 transition-all group/btn rounded-xl"
                                                            >
                                                                <Download className="w-5 h-5 mr-3 group-hover/btn:translate-y-1 transition-transform duration-300" />
                                                                Download Template
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* RIGHT COLUMN - MASSIVE DROPZONE (Step 3) */}
                                                <div className="xl:col-span-7 h-full min-h-[500px]">
                                                    <div
                                                        className={`h-full relative border-4 border-dashed rounded-3xl transition-all duration-500 group flex flex-col items-center justify-center p-12 text-center overflow-hidden bg-white ${!selectedStore
                                                            ? 'border-slate-200 opacity-60 cursor-not-allowed bg-slate-50'
                                                            : 'border-indigo-200 hover:border-indigo-500 hover:shadow-2xl hover:shadow-indigo-500/10 cursor-pointer bg-white'
                                                            }`}
                                                    >
                                                        {/* Animated background when active */}
                                                        {selectedStore && (
                                                            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-50 via-white to-blue-50 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                                                        )}

                                                        <input
                                                            type="file"
                                                            accept=".csv"
                                                            disabled={!selectedStore}
                                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-50"
                                                            onChange={async (e) => {
                                                                const file = e.target.files?.[0];
                                                                if (!file) return;
                                                                if (!currentSupplier) {
                                                                    alert("Please create a supplier profile first.");
                                                                    return;
                                                                }
                                                                if (!selectedStore) {
                                                                    alert("Please select a target store first.");
                                                                    return;
                                                                }
                                                                try {
                                                                    setLoading(true);
                                                                    const uploadRes = await SupplierService.uploadFile({
                                                                        storeSlug: selectedStore.slug,
                                                                        supplierId: currentSupplier.id,
                                                                        file
                                                                    });

                                                                    // IF this upload was to accept a pending order
                                                                    if (pendingAcceptRequestId) {
                                                                        try {
                                                                            const acceptRes = await suppliersApi.acceptRequest(pendingAcceptRequestId);
                                                                            if (acceptRes.data.success) {
                                                                                alert(`Order Accepted Successfully! Data Uploaded (ID: ${uploadRes.upload_id})`);
                                                                                setPendingAcceptRequestId(null);
                                                                                setActiveTab("orders"); // Return to orders
                                                                                fetchData();
                                                                            } else {
                                                                                alert(`Data Uploaded (ID: ${uploadRes.upload_id}), but failed to update order status.`);
                                                                            }
                                                                        } catch (acceptErr: any) {
                                                                            console.error(acceptErr);
                                                                            alert(`Data Uploaded (ID: ${uploadRes.upload_id}), but failed to accept order: ${acceptErr.message}`);
                                                                        }
                                                                    } else {
                                                                        alert(`Upload successful! ID: ${uploadRes.upload_id}`);
                                                                    }
                                                                } catch (err: any) {
                                                                    console.error(err);
                                                                    alert("Upload failed: " + (err.message || "Unknown error"));
                                                                } finally {
                                                                    setLoading(false);
                                                                    e.target.value = "";
                                                                }
                                                            }}
                                                        />

                                                        <div className="relative z-10 pointer-events-none transform group-hover:scale-105 transition-transform duration-500">
                                                            <div className={`w-32 h-32 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl transition-all duration-500 ${selectedStore
                                                                ? 'bg-gradient-to-tr from-indigo-500 to-blue-500 text-white shadow-indigo-500/30'
                                                                : 'bg-slate-200 text-slate-400'
                                                                }`}>
                                                                <Upload className="w-16 h-16" />
                                                            </div>
                                                            <h3 className={`text-3xl font-extrabold mb-4 transition-colors ${selectedStore ? 'text-slate-800 group-hover:text-indigo-600' : 'text-slate-400'}`}>
                                                                {pendingAcceptRequestId ? "Upload Order Data to Accept" : (selectedStore ? "Drop CSV File Here" : "Select Store First")}
                                                            </h3>
                                                            {pendingAcceptRequestId && (
                                                                <div className="mb-4 inline-block px-4 py-1.5 rounded-full bg-amber-50 text-amber-700 text-sm font-bold border border-amber-200 animate-pulse">
                                                                    ⚠️ Action Required for Order #{pendingAcceptRequestId.slice(0, 8)}
                                                                </div>
                                                            )}
                                                            <p className="text-lg text-slate-500 max-w-sm mx-auto">
                                                                {selectedStore
                                                                    ? "Drag and drop your spreadsheet, or click anywhere in this area to browse."
                                                                    : "You must select a target store from the left before you can upload data."}
                                                            </p>
                                                        </div>

                                                        {/* Step Number Background */}
                                                        <div className={`absolute bottom-0 right-0 p-12 transition-opacity duration-300 pointer-events-none select-none ${selectedStore ? 'opacity-5 group-hover:opacity-10 text-indigo-900' : 'opacity-5 text-slate-400'}`}>
                                                            <div className="text-[14rem] font-black leading-none -mb-16 -mr-16">3</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </main>

                {/* Fulfill Reorder Modal */}
                {fulfillModalOpen && requestToFulfill && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 overflow-hidden max-h-[90vh] flex flex-col"
                        >
                            <div className="flex justify-between items-start mb-4 shrink-0">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">Fulfill Reorder #{requestToFulfill.id.slice(0, 6)}</h3>
                                    <p className="text-sm text-slate-500">Provide batch details for the requested items.</p>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setFulfillModalOpen(false)}><XCircle className="w-5 h-5 text-slate-400" /></Button>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                                {fulfillItems.map((item, idx) => (
                                    <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-slate-700 text-sm">{item.medicineName} <span className="text-slate-500 font-normal ms-2">(Qty: {item.quantity})</span></span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Batch Number</label>
                                                <input
                                                    type="text"
                                                    value={item.batchNumber}
                                                    onChange={e => {
                                                        const newItems = [...fulfillItems];
                                                        newItems[idx].batchNumber = e.target.value;
                                                        setFulfillItems(newItems);
                                                    }}
                                                    placeholder="Batch #"
                                                    className="w-full text-sm p-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Expiry Date</label>
                                                <input
                                                    type="date"
                                                    value={item.expiryDate}
                                                    onChange={e => {
                                                        const newItems = [...fulfillItems];
                                                        newItems[idx].expiryDate = e.target.value;
                                                        setFulfillItems(newItems);
                                                    }}
                                                    className="w-full text-sm p-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                                                />
                                            </div>
                                            <div>
                                                 <label className="block text-xs font-medium text-slate-500 mb-1">Cost Price (Optional)</label>
                                                 <input
                                                     type="number"
                                                     value={item.purchasePrice}
                                                     onChange={e => {
                                                         const newItems = [...fulfillItems];
                                                         newItems[idx].purchasePrice = parseFloat(e.target.value);
                                                         setFulfillItems(newItems);
                                                     }}
                                                     className="w-full text-sm p-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                                                 />
                                            </div>
                                            <div>
                                                 <label className="block text-xs font-medium text-slate-500 mb-1">MRP (Optional)</label>
                                                 <input
                                                     type="number"
                                                     value={item.mrp}
                                                     onChange={e => {
                                                         const newItems = [...fulfillItems];
                                                         newItems[idx].mrp = parseFloat(e.target.value);
                                                         setFulfillItems(newItems);
                                                     }}
                                                     className="w-full text-sm p-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                                                 />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100 shrink-0">
                                <Button variant="secondary" onClick={() => setFulfillModalOpen(false)}>Cancel</Button>
                                <Button onClick={handleSubmitFulfillment} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                                    <CheckCircle className="w-4 h-4" /> Confirm & Send
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}

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

            {/* DOCK NAVIGATION */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40">
                <Dock className="bg-white/80 backdrop-blur-xl border border-white/20 shadow-2xl rounded-2xl">
                    <DockItem onClick={() => setActiveTab("dashboard")}>
                        <DockLabel>Dashboard</DockLabel>
                        <DockIcon>
                            <LayoutGrid className={`w-8 h-8 transition-colors ${activeTab === 'dashboard' ? 'text-slate-900 fill-slate-900/10' : 'text-slate-400 hover:text-slate-600'}`} />
                        </DockIcon>
                    </DockItem>

                    <DockItem onClick={() => setActiveTab("marketplace")}>
                        <DockLabel>Marketplace</DockLabel>
                        <DockIcon>
                            <ShoppingBag className={`w-8 h-8 transition-colors ${activeTab === 'marketplace' ? 'text-emerald-600 fill-emerald-600/10' : 'text-slate-400 hover:text-slate-600'}`} />
                        </DockIcon>
                    </DockItem>

                    <DockItem onClick={() => setActiveTab("my-stores")}>
                        <DockLabel>My Stores</DockLabel>
                        <DockIcon>
                            <StoreIcon className={`w-8 h-8 transition-colors ${activeTab === 'my-stores' ? 'text-blue-600 fill-blue-600/10' : 'text-slate-400 hover:text-slate-600'}`} />
                        </DockIcon>
                    </DockItem>

                    <DockItem onClick={() => setActiveTab("requests")}>
                        <DockLabel>Requests</DockLabel>
                        <DockIcon>
                            <Inbox className={`w-8 h-8 transition-colors ${activeTab === 'requests' ? 'text-amber-500 fill-amber-500/10' : 'text-slate-400 hover:text-slate-600'}`} />
                        </DockIcon>
                    </DockItem>

                    <DockItem onClick={() => setActiveTab("orders")}>
                        <DockLabel>Orders</DockLabel>
                        <DockIcon>
                            <Package className={`w-8 h-8 transition-colors ${activeTab === 'orders' ? 'text-indigo-500 fill-indigo-500/10' : 'text-slate-400 hover:text-slate-600'}`} />
                        </DockIcon>
                    </DockItem>

                    <DockItem onClick={() => setActiveTab("profile")}>
                        <DockLabel>Profile</DockLabel>
                        <DockIcon>
                            <User className={`w-8 h-8 transition-colors ${activeTab === 'profile' ? 'text-violet-600 fill-violet-600/10' : 'text-slate-400 hover:text-slate-600'}`} />
                        </DockIcon>
                    </DockItem>

                    <DockItem onClick={() => setActiveTab("upload")}>
                        <DockLabel>Upload</DockLabel>
                        <DockIcon>
                            <Upload className={`w-8 h-8 transition-colors ${activeTab === 'upload' ? 'text-blue-500 fill-blue-500/10' : 'text-slate-400 hover:text-slate-600'}`} />
                        </DockIcon>
                    </DockItem>
                </Dock>
            </div>

            {/* Logout Confirmation Modal */}
            <AnimatePresence>
                {showLogoutConfirm && (
                    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 overflow-hidden border border-slate-100"
                        >
                            <div className="flex flex-col items-center text-center">
                                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4">
                                    <LogOut className="w-6 h-6 text-red-500" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-2">Confirm Logout</h3>
                                <p className="text-slate-500 text-sm mb-6">
                                    Are you sure you want to end your session? You will need to sign in again to access your dashboard.
                                </p>
                                <div className="flex gap-3 w-full">
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowLogoutConfirm(false)}
                                        className="flex-1 border-slate-200 hover:bg-slate-50 text-slate-700"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={confirmLogout}
                                        className="flex-1 bg-red-600 hover:bg-red-700 text-white border-none"
                                    >
                                        Logout
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SupplierDashboard;