// src/pages/SuperAdminDashboard.tsx
import React, { useEffect, useState } from "react";
import { useRecoilValue, useSetRecoilState } from "recoil";
import { authState, clearAuthState } from "../state/auth";
import { motion, AnimatePresence, animate } from "framer-motion";
import {
    Users, Store as StoreIcon, Activity, Search,
    Package, Truck, LogOut, Trash2,
    PieChart, AlertTriangle, Wallet,
    BarChart3, Bell, Lock, UserPlus, Settings, X, ArrowRightLeft,
    Send, Mail, MessageSquare, CheckCircle2, RefreshCw
} from "lucide-react";
import { Dock, DockIcon, DockItem, DockLabel } from "../components/ui/dock";
import { adminApi } from "../lib/api/endpoints";
import type { User, Store, Supplier, AdminStats } from "../lib/types";
import { Button } from "../components/ui/button";
import { useNavigate } from "react-router-dom";
import { FaUserNurse } from "react-icons/fa";
import { MdNotificationsActive } from "react-icons/md";

// --- Types ---

interface AnalyticsData {
    overview: {
        users: { total: number; verified: number };
        stores: { total: number; active: number; inactive: number };
        suppliers: { total: number };
        medicines: { total: number };
        financials: {
            totalRevenue: number;
            inventoryValue: number;
            totalSalesCount: number;
        };
        operations: {
            pendingSupplierRequests: number;
            failedUploads: number;
            expiringBatchesNext30Days: number;
        };
    };
    trends: {
        users: Array<{ date: string; count: number }>;
        sales: Array<{ date: string; count: number; revenue: number }>;
    };
    distributions: {
        paymentMethods: Array<{ method: string; count: number; revenue: number }>;
        userRoles: Array<{ role: string; count: number }>;
    };
    recentCriticalActivity: Array<{
        id: string;
        action: string;
        resource: string;
        createdAt: string;
        user?: { username: string; email: string };
    }>;
}

// --- Components ---

const Counter = ({ value }: { value: number }) => {
    const nodeRef = React.useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const node = nodeRef.current;
        if (!node) return;

        const controls = animate(0, value, {
            duration: 2,
            ease: "easeOut",
            onUpdate(val) {
                node.textContent = Math.round(val).toLocaleString();
            },
        });

        return () => controls.stop();
    }, [value]);

    return <span ref={nodeRef} />;
};

const StatCard = ({ icon: Icon, label, value, color, delay }: any) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, type: "spring", stiffness: 300, damping: 30 }}
        whileHover={{ y: -5, boxShadow: "0 20px 40px -15px rgba(0,0,0,0.1)" }}
        className="relative overflow-hidden bg-white/70 backdrop-blur-2xl border border-white/60 rounded-[2rem] p-6 shadow-sm group cursor-default"
    >
        {/* Background gradient blob */}
        <div className={`absolute -right-6 -top-6 w-32 h-32 bg-gradient-to-br ${color} opacity-[0.05] blur-2xl rounded-full group-hover:opacity-[0.1] transition-opacity duration-500`} />

        <div className="flex items-center justify-between relative z-10">
            <div className={`p-4 bg-gradient-to-br ${color} rounded-2xl shadow-lg transform group-hover:scale-110 transition-transform duration-300 ease-out`}>
                <Icon className="w-6 h-6 text-white" />
            </div>
            <div className="text-right">
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: delay + 0.2 }}
                >
                    <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-none">
                        {typeof value === 'number' ? <Counter value={value} /> : value}
                    </h3>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1.5">{label}</p>
                </motion.div>
            </div>
        </div>

        {/* Bottom shine line */}
        <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
    </motion.div>
);

const getActivityIcon = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes("LOGIN")) return { icon: Lock, color: "text-emerald-500", bg: "bg-emerald-50" };
    if (act.includes("REGISTER") || act.includes("USER")) return { icon: UserPlus, color: "text-blue-500", bg: "bg-blue-50" };
    if (act.includes("STORE")) return { icon: StoreIcon, color: "text-purple-500", bg: "bg-purple-50" };
    if (act.includes("DELETE")) return { icon: Trash2, color: "text-red-500", bg: "bg-red-50" };
    if (act.includes("UPDATE")) return { icon: Settings, color: "text-orange-500", bg: "bg-orange-50" };
    return { icon: Activity, color: "text-slate-500", bg: "bg-slate-50" };
};

const ActivityItem = ({ activity, index }: { activity: any; index: number }) => {
    const { icon: Icon, color, bg } = getActivityIcon(activity.action);
    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 + 0.3 }}
            className="flex items-start gap-4 p-4 hover:bg-slate-50/80 rounded-xl transition-all border-b border-slate-100 last:border-0 group cursor-default"
        >
            <div className={`w-10 h-10 rounded-full ${bg} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-sm`}>
                <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate group-hover:text-black transition-colors">
                    {activity.action}
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                    {activity.user && (
                        <span className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-medium">
                            {activity.user.username}
                        </span>
                    )}
                    {activity.resource && <span className="truncate text-slate-400">on {activity.resource}</span>}
                </div>
            </div>
            <div className="text-xs font-mono text-slate-400 whitespace-nowrap bg-slate-50 px-2 py-1 rounded">
                {new Date(activity.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
        </motion.div>
    );
};

const StatusBadge = ({ isActive }: { isActive: boolean }) => (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isActive
        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
        : "bg-red-100 text-red-800 border border-red-200"
        }`}>
        {isActive ? "Active" : "Suspended"}
    </span>
);

const SimpleBarChart = ({ data, color, height = 40 }: { data: number[], color: string, height?: number }) => {
    const max = Math.max(...data, 1);
    return (
        <div className="flex items-end gap-1 h-full w-full" style={{ height }}>
            {data.map((val, i) => (
                <div
                    key={i}
                    className={`flex-1 rounded-t-sm ${color} opacity-80 hover:opacity-100 transition-opacity`}
                    style={{ height: `${(val / max) * 100}%` }}
                    title={val.toString()}
                />
            ))}
        </div>
    );
};

const TableSkeleton = () => (
    <>
        {[1, 2, 3, 4, 5].map((i) => (
            <tr key={i} className="animate-pulse">
                <td className="px-6 py-4">
                    <div className="h-4 bg-slate-200 rounded w-32 mb-2"></div>
                    <div className="h-3 bg-slate-100 rounded w-20"></div>
                </td>
                <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-40"></div></td>
                <td className="px-6 py-4"><div className="h-6 bg-slate-200 rounded-full w-20"></div></td>
                <td className="px-6 py-4 text-right"><div className="h-8 bg-slate-200 rounded w-24 ml-auto"></div></td>
            </tr>
        ))}
    </>
);

// --- Main Page ---

const SuperAdminDashboard: React.FC = () => {
    const auth = useRecoilValue(authState);
    const setAuth = useSetRecoilState(authState);
    const navigate = useNavigate();

    const NAV_ITEMS = [
        { label: 'Overview', icon: BarChart3, tab: 'overview' },
        { label: 'Analytics', icon: PieChart, tab: 'analytics' },
        { label: 'Stores', icon: StoreIcon, tab: 'stores' },
        { label: 'Suppliers', icon: Truck, tab: 'suppliers' },
        { label: 'Users', icon: Users, tab: 'users' },
        { label: 'Notifications', icon: Bell, tab: 'notifications' },
    ];

    const [activeTab, setActiveTab] = useState<"overview" | "analytics" | "stores" | "suppliers" | "users" | "notifications">("overview");

    // Notification State
    const [notifyForm, setNotifyForm] = useState({
        targetRole: "ALL",
        type: "SYSTEM" as "SYSTEM" | "EMAIL" | "BOTH",
        subject: "",
        message: "",
    });
    const [sending, setSending] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    // Data State
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [stores, setStores] = useState<Store[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);

    // Search / Filter
    const [searchQuery, setSearchQuery] = useState("");

    const [storeToDelete, setStoreToDelete] = useState<{ id: string; name: string } | null>(null);
    const [storeToToggle, setStoreToToggle] = useState<{ id: string; name: string; isActive: boolean } | null>(null);
    const [supplierToDelete, setSupplierToDelete] = useState<{ id: string; name: string } | null>(null);
    const [supplierToToggle, setSupplierToToggle] = useState<{ id: string; name: string; isActive: boolean } | null>(null);
    const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null);
    const [userToConvert, setUserToConvert] = useState<{ id: string; name: string } | null>(null);
    const [userToToggle, setUserToToggle] = useState<{ id: string; name: string; isActive: boolean } | null>(null);
    const [isScrolled, setIsScrolled] = useState(false);

    // Effects
    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === "overview") {
                const res = await adminApi.getStats();
                if (res.data.success) setStats(res.data.data);
            } else if (activeTab === "analytics") {
                const res = await adminApi.getDashboardAnalytics();
                if (res.data.success) setAnalytics(res.data.data);
            } else if (activeTab === "stores") {
                const res = await adminApi.getStores({ q: searchQuery });
                if (res.data.success) setStores(res.data.data.stores);
            } else if (activeTab === "suppliers") {
                const res = await adminApi.getSuppliers(searchQuery);
                if (res.data.success) setSuppliers(res.data.data.suppliers);
            } else if (activeTab === "users") {
                const res = await adminApi.getUsers({ q: searchQuery });
                if (res.data.success) setUsers(res.data.data.users);
            }
        } catch (err) {
            console.error("Failed to fetch admin data", err);
        } finally {
            setLoading(false);
        }
    };

    // Handlers


    const initiateToggleStore = (store: Store) => {
        setStoreToToggle({ id: store.id, name: store.name, isActive: store.isActive || false });
    };

    const performToggleStore = async () => {
        if (!storeToToggle) return;
        try {
            const res = await adminApi.suspendStore(storeToToggle.id, !storeToToggle.isActive);
            if (res.data.success) {
                fetchData();
                setStoreToToggle(null);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const initiateToggleSupplier = (supplier: Supplier) => {
        setSupplierToToggle({ id: supplier.id, name: supplier.name, isActive: supplier.isActive || false });
    };

    const performToggleSupplier = async () => {
        if (!supplierToToggle) return;
        try {
            const res = await adminApi.suspendSupplier(supplierToToggle.id, !supplierToToggle.isActive);
            if (res.data.success) {
                fetchData();
                setSupplierToToggle(null);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const initiateDeleteSupplier = (supplierId: string, supplierName: string) => {
        setSupplierToDelete({ id: supplierId, name: supplierName });
    };

    const performDeleteSupplier = async () => {
        if (!supplierToDelete) return;
        try {
            await adminApi.deleteSupplier(supplierToDelete.id);
            setSupplierToDelete(null);
            console.log(`Supplier ${supplierToDelete.name} deleted successfully.`);
            fetchData();
        } catch (err: any) {
            console.error(err);
            alert("Error: " + err.message);
        }
    };

    const initiateConvertUser = (userId: string, username: string) => {
        setUserToConvert({ id: userId, name: username });
    };

    const performConvertUser = async () => {
        if (!userToConvert) return;
        try {
            const res = await adminApi.convertToSupplier(userToConvert.id);
            if (res.data) {
                // alert(`User ${userToConvert.name} converted to supplier successfully.`);
                setUserToConvert(null);
                fetchData();
            }
        } catch (err: any) {
            console.error(err);
            alert("Error: " + err.message);
        }
    };

    const initiateDeleteUser = (userId: string, username: string) => {
        setUserToDelete({ id: userId, name: username });
    };

    const performDeleteUser = async () => {
        if (!userToDelete) return;
        try {
            await adminApi.deleteUser(userToDelete.id);
            setUserToDelete(null);
            fetchData();
        } catch (err: any) {
            console.error(err);
            alert("Error: " + err.message);
        }
    };

    const initiateToggleUser = (user: User) => {
        setUserToToggle({ id: user.id, name: user.username, isActive: user.isActive || false });
    };

    const performToggleUser = async () => {
        if (!userToToggle) return;
        try {
            const res = await adminApi.suspendUser(userToToggle.id, !userToToggle.isActive);
            if (res.data.success) {
                fetchData();
                setUserToToggle(null);
            }
        } catch (err: any) {
            console.error(err);
            alert("Error: " + (err.message || "Failed to toggle user status"));
        }
    };




    const initiateDeleteStore = (storeId: string, storeName: string) => {
        setStoreToDelete({ id: storeId, name: storeName });
    };

    const performDeleteStore = async () => {
        if (!storeToDelete) return;
        try {
            await adminApi.deleteStore(storeToDelete.id);
            setStoreToDelete(null);
            fetchData();
        } catch (err: any) {
            console.error(err);
            alert("Error: " + err.message);
        }
    };



    const handleLogout = () => {
        setShowLogoutConfirm(true);
    };

    const performLogout = () => {
        setAuth(clearAuthState());
        navigate("/login");
    };

    const handleSendNotification = async (e: React.FormEvent) => {
        e.preventDefault();
        setSending(true);
        try {
            const res: any = await adminApi.sendNotification(notifyForm);
            if (res.data?.success) {
                setShowSuccessModal(true);
                setNotifyForm({ ...notifyForm, subject: "", message: "" });
            } else {
                throw new Error(res.data?.error || "Failed to send notification.");
            }
        } catch (err: any) {
            console.error("Error sending notification:", err);
            alert("Error sending notification: " + (err.response?.data?.message || err.message));
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900">
            {/* Header */}
            <header className={`sticky top-0 z-20 transition-all duration-500 ease-in-out ${isScrolled ? "bg-white/10 backdrop-blur-3xl backdrop-saturate-150 border-none shadow-none support-[backdrop-filter]:bg-white/20" : "bg-transparent border-none shadow-none"}`}>
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <motion.div
                                initial={{ scale: 0.5, opacity: 0, rotate: -180 }}
                                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                                whileHover={{ scale: 1.1, rotate: 10, boxShadow: "0px 10px 25px rgba(79, 70, 229, 0.4)" }}
                                className="w-12 h-12 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30 cursor-pointer"
                            >
                                <FaUserNurse className="w-6 h-6 text-white" />
                            </motion.div>
                            <div>
                                <motion.h1
                                    initial={{ x: -20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: 0.2, duration: 0.5 }}
                                    className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent"
                                >
                                    Admin Console
                                </motion.h1>
                                <motion.p
                                    initial={{ x: -20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: 0.3, duration: 0.5 }}
                                    className="text-xs text-slate-500 font-medium"
                                >
                                    Pharmacy Management System
                                </motion.p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <motion.div
                                initial={{ y: -10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.4 }}
                                whileHover={{ scale: 1.05, backgroundColor: "#f3f4f6" }}
                                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg border border-slate-200/50 cursor-default"
                            >
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <span className="text-xs font-semibold text-slate-600 tracking-wide">SYSTEM ONLINE</span>
                            </motion.div>

                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 32, opacity: 1 }}
                                transition={{ delay: 0.5 }}
                                className="w-[1px] bg-slate-200"
                            />

                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.6, type: "spring" }}
                                className="flex items-center gap-3"
                            >
                                <div className="text-right hidden sm:block">
                                    <p className="text-sm font-semibold text-slate-800">{auth.user?.username}</p>
                                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{auth.user?.globalRole}</p>
                                </div>
                                <motion.div
                                    whileHover={{ scale: 1.1, rotate: 5 }}
                                    className="w-9 h-9 bg-slate-900 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md cursor-pointer border-2 border-slate-900"
                                >
                                    {auth.user?.username?.charAt(0).toUpperCase()}
                                </motion.div>
                                <motion.div
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleLogout}
                                        className="ml-2 !bg-red-600 !text-white hover:!bg-red-700 border !border-red-600 px-6 gap-2 transition-all duration-300 shadow-md shadow-red-500/30"
                                        title="Logout"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        <span className="font-semibold">Sign Out</span>
                                    </Button>
                                </motion.div>
                            </motion.div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="max-w-7xl mx-auto px-6 py-8 pb-32">
                <AnimatePresence mode="wait">
                    {activeTab === "overview" && (
                        <motion.div
                            key="overview"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            {/* Stats Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                                <StatCard
                                    icon={StoreIcon}
                                    label="Total Stores"
                                    value={loading ? "..." : stats?.counts.stores ?? 0}
                                    color="from-blue-500 to-cyan-500"
                                    delay={0}
                                />
                                <StatCard
                                    icon={Users}
                                    label="Total Users"
                                    value={loading ? "..." : stats?.counts.users ?? 0}
                                    color="from-emerald-500 to-teal-500"
                                    delay={0.1}
                                />
                                <StatCard
                                    icon={Truck}
                                    label="Active Batches"
                                    value={loading ? "..." : stats?.counts.batches ?? 0}
                                    color="from-orange-500 to-amber-500"
                                    delay={0.2}
                                />
                                <StatCard
                                    icon={Package}
                                    label="Items Listed"
                                    value={loading ? "..." : stats?.counts.medicines ?? 0}
                                    color="from-purple-500 to-pink-500"
                                    delay={0.3}
                                />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Recent Activity */}
                                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                            <Activity className="w-5 h-5 text-indigo-500" />
                                            Recent System Activity
                                        </h3>
                                    </div>
                                    <div className="max-h-[400px] overflow-y-auto">
                                        {loading ? (
                                            <div className="p-8 text-center text-slate-400">Loading activity...</div>
                                        ) : stats?.recentActivity.length === 0 ? (
                                            <div className="p-8 text-center text-slate-400">No recent activity</div>
                                        ) : (
                                            stats?.recentActivity.map((act, idx) => (
                                                <ActivityItem key={act.id} activity={act} index={idx} />
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Quick Actions Panel */}
                                <div className="space-y-6">
                                    <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white shadow-xl shadow-indigo-200">
                                        <h3 className="text-lg font-bold mb-2">System Health</h3>
                                        <p className="text-indigo-100 text-sm mb-6">
                                            All systems are operational. Database latency is normal.
                                        </p>
                                        <div className="flex items-center gap-2 text-xs font-mono bg-white/10 p-3 rounded-lg">
                                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                                            STATUS: OPTIMAL
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                        <h3 className="font-bold text-slate-800 mb-4">Quick Navigation</h3>
                                        <div className="space-y-3">
                                            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setActiveTab("stores")}>
                                                <StoreIcon className="w-4 h-4 text-slate-500" />
                                                Manage Stores
                                            </Button>
                                            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setActiveTab("suppliers")}>
                                                <Truck className="w-4 h-4 text-slate-500" />
                                                Manage Suppliers
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === "analytics" && analytics && (
                        <motion.div
                            key="analytics"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-6"
                        >
                            {/* Top Level Financials */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white shadow-xl shadow-indigo-200">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="text-indigo-200 text-sm font-medium mb-1">Total Revenue</p>
                                            <h3 className="text-3xl font-bold">${analytics.overview.financials.totalRevenue.toLocaleString()}</h3>
                                        </div>
                                        <div className="p-2 bg-white/20 rounded-lg">
                                            <Wallet className="w-6 h-6 text-white" />
                                        </div>
                                    </div>
                                    <p className="text-xs text-indigo-200">Across {analytics.overview.financials.totalSalesCount} sales</p>
                                </div>
                                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="text-slate-500 text-sm font-medium mb-1">Inventory Value</p>
                                            <h3 className="text-3xl font-bold text-slate-800">${analytics.overview.financials.inventoryValue.toLocaleString()}</h3>
                                        </div>
                                        <div className="p-2 bg-emerald-100 rounded-lg">
                                            <Package className="w-6 h-6 text-emerald-600" />
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-400">Estimated value</p>
                                </div>
                                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="text-slate-500 text-sm font-medium mb-1">Expiring Batches (30d)</p>
                                            <h3 className="text-3xl font-bold text-slate-800">{analytics.overview.operations.expiringBatchesNext30Days}</h3>
                                        </div>
                                        <div className="p-2 bg-orange-100 rounded-lg">
                                            <AlertTriangle className="w-6 h-6 text-orange-600" />
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-400">Requiring attention</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Distributions */}
                                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                    <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                        <PieChart className="w-5 h-5 text-indigo-500" />
                                        User Distribution
                                    </h3>
                                    <div className="space-y-4">
                                        {analytics.distributions.userRoles.map((role) => (
                                            <div key={role.role}>
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="font-medium text-slate-700">{role.role}</span>
                                                    <span className="text-slate-500">{role.count} users</span>
                                                </div>
                                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-indigo-500 rounded-full"
                                                        style={{ width: `${(role.count / analytics.overview.users.total) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Operational Health */}
                                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                    <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                        <Activity className="w-5 h-5 text-indigo-500" />
                                        Operational Health
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 rounded-xl bg-orange-50 border border-orange-100">
                                            <p className="text-orange-600 text-sm font-medium">Pending Requests</p>
                                            <p className="text-2xl font-bold text-orange-800">{analytics.overview.operations.pendingSupplierRequests}</p>
                                        </div>
                                        <div className="p-4 rounded-xl bg-red-50 border border-red-100">
                                            <p className="text-red-600 text-sm font-medium">Failed Uploads</p>
                                            <p className="text-2xl font-bold text-red-800">{analytics.overview.operations.failedUploads}</p>
                                        </div>
                                        <div className="col-span-2 p-4 rounded-xl bg-slate-50 border border-slate-100">
                                            <div className="flex justify-between items-end mb-2">
                                                <p className="text-slate-600 text-sm font-medium">Sales Trend (Last 30 Days)</p>
                                                <p className="text-xs text-slate-400">Daily Revenue</p>
                                            </div>
                                            <SimpleBarChart
                                                data={analytics.trends.sales.map(s => s.revenue)}
                                                color="bg-emerald-500"
                                                height={60}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Critical Activity */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5 text-red-500" />
                                    Recent Critical Actions
                                </h3>
                                <div className="space-y-1">
                                    {analytics.recentCriticalActivity.length === 0 ? (
                                        <p className="text-slate-400 text-center py-4">No critical actions recorded recently.</p>
                                    ) : (
                                        analytics.recentCriticalActivity.map((act, idx) => (
                                            <ActivityItem key={act.id} activity={act} index={idx} />
                                        ))
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === "stores" && (
                        <motion.div
                            key="stores"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                        >
                            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between gap-4">
                                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <StoreIcon className="w-5 h-5 text-indigo-500" />
                                    Registered Stores
                                </h2>
                                <div className="flex gap-2 items-center">
                                    <Button
                                        size="icon"
                                        className="w-12 h-12 !bg-transparent !text-black hover:!bg-slate-100 rounded-lg transition-all"
                                        onClick={fetchData}
                                        title="Refresh Stores"
                                    >
                                        <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
                                    </Button>
                                    <div className="relative">
                                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search by name..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-9 pr-9 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64 shadow-sm"
                                        />
                                        {searchQuery && (
                                            <p
                                                onClick={() => setSearchQuery("")}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition-colors"
                                            >
                                                <X className="w-3 h-3" />
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="px-6 py-4 font-semibold text-slate-700">Store Name</th>
                                            <th className="px-6 py-4 font-semibold text-slate-700">Slug</th>
                                            <th className="px-6 py-4 font-semibold text-slate-700">Owner Email</th>
                                            <th className="px-6 py-4 font-semibold text-slate-700">Status</th>
                                            <th className="px-6 py-4 font-semibold text-slate-700 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        <AnimatePresence mode="wait">
                                            {loading ? (
                                                <motion.tr
                                                    key="skeleton"
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                >
                                                    <td colSpan={5} className="p-0 border-none">
                                                        <table className="w-full">
                                                            <tbody>
                                                                <TableSkeleton />
                                                            </tbody>
                                                        </table>
                                                    </td>
                                                </motion.tr>
                                            ) : (
                                                <>
                                                    {stores.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).map((store, index) => (
                                                        <motion.tr
                                                            key={store.id}
                                                            initial={{ opacity: 0, y: 20 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: -20 }}
                                                            transition={{ duration: 0.3, delay: index * 0.05 }}
                                                            className="hover:bg-indigo-50/50 transition-colors group cursor-default"
                                                        >
                                                            <td className="px-6 py-4">
                                                                <div className="flex flex-col">
                                                                    <span className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{store.name}</span>
                                                                    <span className="text-xs text-slate-400">ID: {store.id.slice(0, 8)}...</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className="font-mono text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded border border-slate-200 group-hover:bg-white group-hover:border-indigo-200 transition-colors">
                                                                    {store.slug}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-violet-500 to-fuchsia-500 text-white text-[10px] flex items-center justify-center font-bold">
                                                                        {store.users?.[0]?.user?.email?.[0].toUpperCase() || "?"}
                                                                    </div>
                                                                    <span className="text-slate-600 text-sm">{store.users?.[0]?.user?.email || "No Owner"}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <StatusBadge isActive={store.isActive || false} />
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="flex items-center justify-end gap-3 opacity-80 group-hover:opacity-100 transition-opacity">
                                                                    <Button
                                                                        size="sm"
                                                                        className="!bg-black !text-white hover:!bg-slate-800 !border !border-black hover:scale-105 transition-all shadow-md shadow-slate-200"
                                                                        onClick={() => initiateToggleStore(store)}
                                                                    >
                                                                        {store.isActive ? "Suspend" : "Activate"}
                                                                    </Button>
                                                                    <p
                                                                        className="ml-2 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all hover:scale-110"
                                                                        onClick={() => initiateDeleteStore(store.id, store.name)}
                                                                        title="Delete Store"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </p>
                                                                </div>
                                                            </td>
                                                        </motion.tr>
                                                    ))}
                                                    {stores.length === 0 && (
                                                        <tr>
                                                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                                                No stores found.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </>
                                            )}
                                        </AnimatePresence>
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === "suppliers" && (
                        <motion.div
                            key="suppliers"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                        >
                            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between gap-4">
                                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <Truck className="w-5 h-5 text-indigo-500" />
                                    Global Suppliers
                                </h2>
                                <div className="flex gap-2 items-center">
                                    <Button
                                        size="icon"
                                        className="w-12 h-12 !bg-transparent !text-black hover:!bg-slate-100 rounded-lg transition-all"
                                        onClick={fetchData}
                                        title="Refresh Suppliers"
                                    >
                                        <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
                                    </Button>
                                    <div className="relative">
                                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search by name..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-9 pr-9 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64 shadow-sm"
                                        />
                                        {searchQuery && (
                                            <p
                                                onClick={() => setSearchQuery("")}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                                            >
                                                <X className="w-3 h-3" />
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="px-6 py-4 font-semibold text-slate-700">Supplier Name</th>
                                            <th className="px-6 py-4 font-semibold text-slate-700">Contact</th>
                                            <th className="px-6 py-4 font-semibold text-slate-700">Linked Account</th>
                                            <th className="px-6 py-4 font-semibold text-slate-700">Status</th>
                                            <th className="px-6 py-4 font-semibold text-slate-700 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        <AnimatePresence mode="wait">
                                            {loading ? (
                                                <motion.tr
                                                    key="skeleton"
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                >
                                                    <td colSpan={5} className="p-0 border-none">
                                                        <table className="w-full">
                                                            <tbody>
                                                                <TableSkeleton />
                                                            </tbody>
                                                        </table>
                                                    </td>
                                                </motion.tr>
                                            ) : (
                                                <>
                                                    {suppliers.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).map((supplier, index) => (
                                                        <motion.tr
                                                            key={supplier.id}
                                                            initial={{ opacity: 0, y: 20 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: -20 }}
                                                            transition={{ duration: 0.3, delay: index * 0.05 }}
                                                            className="hover:bg-slate-50 transition-colors"
                                                        >
                                                            <td className="px-6 py-4 font-medium text-slate-900">{supplier.name}</td>
                                                            <td className="px-6 py-4 text-slate-500">{supplier.contactName || "-"}</td>
                                                            <td className="px-6 py-4 text-slate-500">
                                                                <div className="flex flex-col">
                                                                    <span>{supplier.user?.email || "No Account"}</span>
                                                                    <span className="text-xs text-slate-400">{supplier.user?.username}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <StatusBadge isActive={supplier.isActive || false} />
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="flex items-center justify-end gap-3 opacity-80 group-hover:opacity-100 transition-opacity">
                                                                    <Button
                                                                        size="sm"
                                                                        className="!bg-black !text-white hover:!bg-slate-800 !border !border-black hover:scale-105 transition-all shadow-md shadow-slate-200"
                                                                        onClick={() => initiateToggleSupplier(supplier)}
                                                                    >
                                                                        {supplier.isActive ? "Suspend" : "Activate"}
                                                                    </Button>
                                                                    <p
                                                                        className="ml-2 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all hover:scale-110"
                                                                        onClick={() => initiateDeleteSupplier(supplier.id, supplier.name)}
                                                                        title="Delete Supplier"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </p>
                                                                </div>
                                                            </td>
                                                        </motion.tr>
                                                    ))}
                                                    {suppliers.length === 0 && (
                                                        <tr>
                                                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                                                No suppliers found.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </>
                                            )}
                                        </AnimatePresence>
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    )}


                    {activeTab === "users" && (
                        <motion.div
                            key="users"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                        >
                            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between gap-4">
                                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <Users className="w-5 h-5 text-indigo-500" />
                                    User Management
                                </h2>
                                <div className="flex gap-2 items-center">
                                    <Button
                                        size="icon"
                                        className="w-12 h-12 !bg-transparent !text-black hover:!bg-slate-100 rounded-lg transition-all"
                                        onClick={fetchData}
                                        title="Refresh Users"
                                    >
                                        <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
                                    </Button>
                                    <div className="relative">
                                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search by username or email..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-9 pr-9 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64 shadow-sm"
                                        />
                                        {searchQuery && (
                                            <p
                                                onClick={() => setSearchQuery("")}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                                            >
                                                <X className="w-3 h-3" />
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="px-6 py-4 font-semibold text-slate-700">User Details</th>
                                            <th className="px-6 py-4 font-semibold text-slate-700">Email Address</th>
                                            <th className="px-6 py-4 font-semibold text-slate-700">Role</th>
                                            <th className="px-6 py-4 font-semibold text-slate-700">Status</th>
                                            <th className="px-6 py-4 font-semibold text-slate-700 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        <AnimatePresence mode="wait">
                                            {loading ? (
                                                <motion.tr
                                                    key="skeleton"
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                >
                                                    <td colSpan={5} className="p-0 border-none">
                                                        <table className="w-full">
                                                            <tbody>
                                                                <TableSkeleton />
                                                            </tbody>
                                                        </table>
                                                    </td>
                                                </motion.tr>
                                            ) : (
                                                <>
                                                    {users.filter(u =>
                                                        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                        u.email.toLowerCase().includes(searchQuery.toLowerCase())
                                                    ).map((user, index) => (
                                                        <motion.tr
                                                            key={user.id}
                                                            initial={{ opacity: 0, y: 20 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: -20 }}
                                                            transition={{ duration: 0.3, delay: index * 0.05 }}
                                                            className="hover:bg-slate-50 transition-colors group cursor-default"
                                                        >
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs ring-2 ring-white shadow-sm">
                                                                        {user.username.charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <div>
                                                                        <p className="font-bold text-slate-800">{user.username}</p>
                                                                        <p className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md inline-block mt-0.5 font-mono">ID: {user.id.slice(0, 8)}</p>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-slate-600">
                                                                <div className="flex items-center gap-2">
                                                                    <Mail className="w-3 h-3 text-slate-400" />
                                                                    {user.email}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className="px-2.5 py-1 rounded-lg text-xs font-bold border bg-white border-slate-200 text-slate-700 shadow-sm">
                                                                    {user.globalRole || "N/A"}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <StatusBadge isActive={user.isActive || false} />
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                                                    {user.globalRole === "USER" && (
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="!bg-black !text-white hover:!bg-slate-800 border-none h-8 mr-2"
                                                                            onClick={() => initiateConvertUser(user.id, user.username)}
                                                                        >
                                                                            Convert
                                                                        </Button>
                                                                    )}
                                                                    <Button
                                                                        size="sm"
                                                                        className="!bg-black !text-white hover:!bg-slate-800 !border !border-black hover:scale-105 transition-all shadow-md shadow-slate-200 h-8 gap-2 font-medium"
                                                                        onClick={() => initiateToggleUser(user)}
                                                                    >
                                                                        {user.isActive ? "Suspend" : "Activate"}
                                                                    </Button>
                                                                    <p
                                                                        className="ml-2 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all hover:scale-110 cursor-pointer"
                                                                        onClick={() => initiateDeleteUser(user.id, user.username)}
                                                                        title="Delete User"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </p>
                                                                </div>
                                                            </td>
                                                        </motion.tr>
                                                    ))}
                                                    {!loading && users.length === 0 && (
                                                        <tr>
                                                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                                                No users found.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </>
                                            )}
                                        </AnimatePresence>
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === "notifications" && (
                        <motion.div
                            key="notifications"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.4, type: "spring", bounce: 0.3 }}
                            className="max-w-4xl mx-auto"
                        >
                            <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-2xl border border-white/60 overflow-hidden relative">
                                {/* Decorative background elements */}
                                <div className="absolute top-0 right-0 w-96 h-96 bg-slate-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                                <div className="absolute bottom-0 left-0 w-64 h-64 bg-gray-500/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3 pointer-events-none" />

                                <div className="p-8 md:p-10 relative z-10">
                                    <div className="flex items-center gap-4 mb-8">
                                        <motion.div
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            transition={{ delay: 0.1 }}
                                            className="w-12 h-12 bg-transparent rounded-xl flex items-center justify-center border-2 border-slate-200"
                                        >
                                            <MdNotificationsActive className="w-6 h-6 text-black" />
                                        </motion.div>
                                        <div>
                                            <motion.h2
                                                initial={{ x: -20, opacity: 0 }}
                                                animate={{ x: 0, opacity: 1 }}
                                                transition={{ delay: 0.2 }}
                                                className="text-2xl font-bold text-slate-900 tracking-tight"
                                            >
                                                Broadcast Center
                                            </motion.h2>
                                            <motion.p
                                                initial={{ x: -20, opacity: 0 }}
                                                animate={{ x: 0, opacity: 1 }}
                                                transition={{ delay: 0.3 }}
                                                className="text-slate-500 text-sm"
                                            >
                                                Send important updates and announcements to your network.
                                            </motion.p>
                                        </div>
                                    </div>

                                    <form onSubmit={handleSendNotification} className="space-y-8">
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                            {/* Target Audience */}
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.4 }}
                                                className="space-y-4"
                                            >
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Target Audience</label>
                                                <div className="grid grid-cols-1 gap-3">
                                                    {[
                                                        { value: 'ALL', label: 'All Users', icon: Users },
                                                        { value: 'SUPPLIER', label: 'Suppliers Only', icon: Truck },
                                                        { value: 'STORE_OWNER', label: 'Store Owners', icon: StoreIcon },
                                                    ].map((opt) => (
                                                        <div
                                                            key={opt.value}
                                                            onClick={() => setNotifyForm({ ...notifyForm, targetRole: opt.value })}
                                                            className={`group flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 relative overflow-hidden ${notifyForm.targetRole === opt.value
                                                                ? 'border-black bg-slate-50 shadow-sm'
                                                                : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                                                                }`}
                                                        >
                                                            <div className={`p-2 rounded-lg transition-colors duration-200 ${notifyForm.targetRole === opt.value ? 'bg-black text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700'}`}>
                                                                <opt.icon className="w-4 h-4" />
                                                            </div>
                                                            <span className={`text-sm font-bold transition-colors ${notifyForm.targetRole === opt.value ? 'text-black' : 'text-slate-600'}`}>{opt.label}</span>
                                                            {notifyForm.targetRole === opt.value && (
                                                                <motion.div layoutId="audience-check" className="absolute right-3 text-black">
                                                                    <CheckCircle2 className="w-5 h-5" />
                                                                </motion.div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </motion.div>

                                            {/* Delivery Method */}
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.5 }}
                                                className="space-y-4"
                                            >
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Delivery Method</label>
                                                <div className="grid grid-cols-1 gap-3">
                                                    {[
                                                        { value: 'SYSTEM', label: 'In-App Notification', icon: Bell },
                                                        { value: 'EMAIL', label: 'Email Only', icon: Mail },
                                                        { value: 'BOTH', label: 'Both Channels', icon: Send },
                                                    ].map((opt) => (
                                                        <div
                                                            key={opt.value}
                                                            onClick={() => setNotifyForm({ ...notifyForm, type: opt.value as any })}
                                                            className={`group flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 relative overflow-hidden ${notifyForm.type === opt.value
                                                                ? 'border-black bg-slate-50 shadow-sm'
                                                                : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                                                                }`}
                                                        >
                                                            <div className={`p-2 rounded-lg transition-colors duration-200 ${notifyForm.type === opt.value ? 'bg-black text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700'}`}>
                                                                <opt.icon className="w-4 h-4" />
                                                            </div>
                                                            <span className={`text-sm font-bold transition-colors ${notifyForm.type === opt.value ? 'text-black' : 'text-slate-600'}`}>{opt.label}</span>
                                                            {notifyForm.type === opt.value && (
                                                                <motion.div layoutId="method-check" className="absolute right-3 text-black">
                                                                    <CheckCircle2 className="w-5 h-5" />
                                                                </motion.div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        </div>

                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.6 }}
                                            className="space-y-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100"
                                        >
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Subject Line</label>
                                                <div className="relative group">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-black transition-colors">
                                                        <MessageSquare className="w-5 h-5" />
                                                    </span>
                                                    <input
                                                        required
                                                        type="text"
                                                        className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-xl focus:bg-white focus:border-black focus:ring-4 focus:ring-black/5 transition-all outline-none font-medium text-slate-800 placeholder:text-slate-300"
                                                        placeholder="e.g., Scheduled Maintenance"
                                                        value={notifyForm.subject}
                                                        onChange={e => setNotifyForm({ ...notifyForm, subject: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Message Body</label>
                                                <textarea
                                                    required
                                                    rows={6}
                                                    className="w-full px-6 py-4 bg-white border border-slate-200 rounded-xl focus:bg-white focus:border-black focus:ring-4 focus:ring-black/5 transition-all outline-none font-medium text-slate-800 placeholder:text-slate-300 resize-none leading-relaxed"
                                                    placeholder="Type your important announcement here..."
                                                    value={notifyForm.message}
                                                    onChange={e => setNotifyForm({ ...notifyForm, message: e.target.value })}
                                                />
                                                <div className="flex justify-between items-center text-xs text-slate-400 px-1">
                                                    <span>HTML formatting supported for emails</span>
                                                    <span>{notifyForm.message.length} characters</span>
                                                </div>
                                            </div>
                                        </motion.div>

                                        <div className="flex justify-end pt-4">
                                            <button
                                                type="submit"
                                                disabled={sending}
                                                className={`relative overflow-hidden h-10 px-8 rounded-lg !text-white font-bold shadow-lg transition-all duration-300 flex items-center justify-center ${sending ? '!bg-black opacity-80 cursor-wait' : '!bg-black hover:!bg-slate-800 hover:scale-[1.02] hover:shadow-slate-900/20'
                                                    }`}
                                            >
                                                <span className="relative z-10 flex items-center gap-3">
                                                    {sending ? "Dispatching..." : "Send Broadcast"}
                                                    {!sending && <Send className="w-5 h-5" />}
                                                </span>
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* Notification Success Modal */}
            <AnimatePresence>
                {showSuccessModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
                            onClick={() => setShowSuccessModal(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm border border-slate-100"
                        >
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-2">
                                    <CheckCircle2 className="w-8 h-8 text-emerald-500 translate-x-0.5" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">Success!</h3>
                                    <p className="text-slate-500 mt-2 text-sm leading-relaxed">
                                        Your broadcast message has been queued for delivery to all selected recipients.
                                    </p>
                                </div>
                                <div className="w-full mt-4">
                                    <Button
                                        className="w-full h-12 rounded-xl !bg-black hover:!bg-slate-800 text-white border-none shadow-lg shadow-slate-900/20 font-semibold"
                                        onClick={() => setShowSuccessModal(false)}
                                    >
                                        Done
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Logout Confirmation Modal */}
            <AnimatePresence>
                {showLogoutConfirm && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
                            onClick={() => setShowLogoutConfirm(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm border border-slate-100"
                        >
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-2">
                                    <LogOut className="w-8 h-8 text-red-500 translate-x-0.5" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">Sign Out</h3>
                                    <p className="text-slate-500 mt-2 text-sm leading-relaxed">
                                        Are you sure you want to end your session? You'll need to sign in again.
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-3 w-full mt-4">
                                    <Button
                                        variant="outline"
                                        className="h-12 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-semibold"
                                        onClick={() => setShowLogoutConfirm(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className="h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white border-none shadow-lg shadow-red-500/20 font-semibold"
                                        onClick={performLogout}
                                    >
                                        Yes, Sign Out
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Delete Store Confirmation Modal */}
            <AnimatePresence>
                {storeToDelete && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
                            onClick={() => setStoreToDelete(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm border border-slate-100"
                        >
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-2">
                                    <Trash2 className="w-8 h-8 text-red-500 translate-x-0.5" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">Delete Store?</h3>
                                    <p className="text-slate-500 mt-2 text-sm leading-relaxed">
                                        Are you sure you want to permanently delete <span className="font-semibold text-slate-900">"{storeToDelete.name}"</span>?
                                        <br />
                                        <span className="text-xs text-red-500 mt-1 block">This action cannot be undone.</span>
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-3 w-full mt-4">
                                    <Button
                                        variant="outline"
                                        className="h-12 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-semibold"
                                        onClick={() => setStoreToDelete(null)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className="h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white border-none shadow-lg shadow-red-500/20 font-semibold"
                                        onClick={performDeleteStore}
                                    >
                                        Yes, Delete
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Suspend/Activate Store Confirmation Modal */}
            <AnimatePresence>
                {storeToToggle && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
                            onClick={() => setStoreToToggle(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm border border-slate-100"
                        >
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-2 ${storeToToggle.isActive ? "bg-amber-50" : "bg-emerald-50"}`}>
                                    {storeToToggle.isActive ? (
                                        <Lock className="w-8 h-8 text-amber-500" />
                                    ) : (
                                        <Activity className="w-8 h-8 text-emerald-500" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">
                                        {storeToToggle.isActive ? "Suspend Store?" : "Activate Store?"}
                                    </h3>
                                    <p className="text-slate-500 mt-2 text-sm leading-relaxed">
                                        Are you sure you want to {storeToToggle.isActive ? "suspend" : "activate"} access for <span className="font-semibold text-slate-900">"{storeToToggle.name}"</span>?
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-3 w-full mt-4">
                                    <Button
                                        variant="outline"
                                        className="h-12 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-semibold"
                                        onClick={() => setStoreToToggle(null)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className={`h-12 rounded-xl text-white border-none shadow-lg font-semibold ${storeToToggle.isActive
                                            ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
                                            : "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20"
                                            }`}
                                        onClick={performToggleStore}
                                    >
                                        Confirm
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Delete Supplier Confirmation Modal */}
            <AnimatePresence>
                {supplierToDelete && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
                            onClick={() => setSupplierToDelete(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm border border-slate-100"
                        >
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-2">
                                    <Trash2 className="w-8 h-8 text-red-500 translate-x-0.5" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">Delete Supplier?</h3>
                                    <p className="text-slate-500 mt-2 text-sm leading-relaxed">
                                        Are you sure you want to permanently delete <span className="font-semibold text-slate-900">"{supplierToDelete.name}"</span>?
                                        <br />
                                        <span className="text-xs text-red-500 mt-1 block">This action cannot be undone.</span>
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-3 w-full mt-4">
                                    <Button
                                        variant="outline"
                                        className="h-12 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-semibold"
                                        onClick={() => setSupplierToDelete(null)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className="h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white border-none shadow-lg shadow-red-500/20 font-semibold"
                                        onClick={performDeleteSupplier}
                                    >
                                        Yes, Delete
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Suspend/Activate Supplier Confirmation Modal */}
            <AnimatePresence>
                {supplierToToggle && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
                            onClick={() => setSupplierToToggle(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm border border-slate-100"
                        >
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-2 ${supplierToToggle.isActive ? "bg-amber-50" : "bg-emerald-50"}`}>
                                    {supplierToToggle.isActive ? (
                                        <Lock className="w-8 h-8 text-amber-500" />
                                    ) : (
                                        <Activity className="w-8 h-8 text-emerald-500" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">
                                        {supplierToToggle.isActive ? "Suspend Supplier?" : "Activate Supplier?"}
                                    </h3>
                                    <p className="text-slate-500 mt-2 text-sm leading-relaxed">
                                        Are you sure you want to {supplierToToggle.isActive ? "suspend" : "activate"} access for <span className="font-semibold text-slate-900">"{supplierToToggle.name}"</span>?
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-3 w-full mt-4">
                                    <Button
                                        variant="outline"
                                        className="h-12 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-semibold"
                                        onClick={() => setSupplierToToggle(null)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className={`h-12 rounded-xl text-white border-none shadow-lg font-semibold ${supplierToToggle.isActive
                                            ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
                                            : "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20"
                                            }`}
                                        onClick={performToggleSupplier}
                                    >
                                        Confirm
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Delete User Confirmation Modal */}
            <AnimatePresence>
                {userToDelete && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
                            onClick={() => setUserToDelete(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm border border-slate-100"
                        >
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-2">
                                    <Trash2 className="w-8 h-8 text-red-500 translate-x-0.5" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">Delete User?</h3>
                                    <p className="text-slate-500 mt-2 text-sm leading-relaxed">
                                        Are you sure you want to permanently delete <span className="font-semibold text-slate-900">"{userToDelete.name}"</span>?
                                        <br />
                                        <span className="text-xs text-red-500 mt-1 block">This action cannot be undone.</span>
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-3 w-full mt-4">
                                    <Button
                                        variant="outline"
                                        className="h-12 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-semibold"
                                        onClick={() => setUserToDelete(null)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className="h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white border-none shadow-lg shadow-red-500/20 font-semibold"
                                        onClick={performDeleteUser}
                                    >
                                        Yes, Delete
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Convert User to Supplier Confirmation Modal */}
            <AnimatePresence>
                {userToConvert && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
                            onClick={() => setUserToConvert(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm border border-slate-100"
                        >
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-2">
                                    <ArrowRightLeft className="w-8 h-8 text-indigo-500" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">Convert to Supplier?</h3>
                                    <p className="text-slate-500 mt-2 text-sm leading-relaxed">
                                        Are you sure you want to upgrade <span className="font-semibold text-slate-900">"{userToConvert.name}"</span> to a Supplier account?
                                        <br />
                                        <span className="text-xs text-indigo-500 mt-1 block">They will gain access to supplier features.</span>
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-3 w-full mt-4">
                                    <Button
                                        variant="outline"
                                        className="h-12 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-semibold"
                                        onClick={() => setUserToConvert(null)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className="h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-lg shadow-indigo-500/20 font-semibold"
                                        onClick={performConvertUser}
                                    >
                                        Confirm
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            {/* Suspend/Activate User Confirmation Modal */}
            <AnimatePresence>
                {userToToggle && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
                            onClick={() => setUserToToggle(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm border border-slate-100"
                        >
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-2 ${userToToggle.isActive ? "bg-amber-50" : "bg-emerald-50"}`}>
                                    {userToToggle.isActive ? (
                                        <Lock className="w-8 h-8 text-amber-500" />
                                    ) : (
                                        <Activity className="w-8 h-8 text-emerald-500" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">
                                        {userToToggle.isActive ? "Suspend User?" : "Activate User?"}
                                    </h3>
                                    <p className="text-slate-500 mt-2 text-sm leading-relaxed">
                                        Are you sure you want to {userToToggle.isActive ? "suspend" : "activate"} access for <span className="font-semibold text-slate-900">"{userToToggle.name}"</span>?
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-3 w-full mt-4">
                                    <Button
                                        variant="outline"
                                        className="h-12 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-semibold"
                                        onClick={() => setUserToToggle(null)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className={`h-12 rounded-xl text-white border-none shadow-lg font-semibold ${userToToggle.isActive
                                            ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
                                            : "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20"
                                            }`}
                                        onClick={performToggleUser}
                                    >
                                        Confirm
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>



            {/* Dock Navigation */}
            <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center pointer-events-none">
                <div className="pointer-events-auto">
                    <Dock className="bg-white/80 backdrop-blur-xl border border-slate-200/50 shadow-2xl rounded-2xl dark:bg-white/80 dark:border-slate-200/50">
                        {NAV_ITEMS.map((item) => (
                            <DockItem key={item.tab} onClick={() => setActiveTab(item.tab as any)}>
                                <DockLabel>{item.label}</DockLabel>
                                <DockIcon>
                                    <item.icon className={`w-6 h-6 ${activeTab === item.tab ? 'text-black' : 'text-slate-500'}`} />
                                </DockIcon>
                            </DockItem>
                        ))}
                    </Dock>
                </div>
            </div>
        </div >
    );
};

export default SuperAdminDashboard;
