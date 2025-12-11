// src/pages/SuperAdminDashboard.tsx
import React, { useEffect, useState } from "react";
import { useRecoilValue } from "recoil";
import { authState } from "../state/auth";
import { motion, AnimatePresence } from "framer-motion";
import {
    Shield, Users, Store as StoreIcon, Activity, Search,
    Package, Truck, LogOut, Trash2,
    PieChart, AlertTriangle, Wallet,
} from "lucide-react";

import { adminApi } from "../lib/api/endpoints";
import type { User, Store, Supplier, AdminStats } from "../lib/types";

import { Button } from "../components/ui/button";
import { useNavigate } from "react-router-dom";
import { useSetRecoilState } from "recoil";
import { clearAuthState } from "../state/auth";

// --- Types ---

// Local interfaces removed in favor of shared types

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

const ActivityItem = ({ activity }: { activity: any }) => (
    <div className="flex items-center gap-4 p-4 hover:bg-white/50 rounded-xl transition-colors border-b border-slate-100 last:border-0">
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
            <Activity className="w-5 h-5" />
        </div>
        <div className="flex-1">
            <p className="text-sm font-medium text-slate-800">
                <span className="text-purple-600 font-bold">{activity.action}</span>
                {activity.resource && <span className="text-slate-500"> on {activity.resource}</span>}
            </p>
            <p className="text-xs text-slate-400">
                {new Date(activity.createdAt).toLocaleString()}
            </p>
        </div>
    </div>
);

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

// --- Main Page ---

const SuperAdminDashboard: React.FC = () => {
    const auth = useRecoilValue(authState);
    const setAuth = useSetRecoilState(authState);
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<"overview" | "analytics" | "stores" | "suppliers" | "users" | "notifications">("overview");

    // Notification State
    const [notifyForm, setNotifyForm] = useState({
        targetRole: "ALL",
        type: "SYSTEM" as "SYSTEM" | "EMAIL" | "BOTH",
        subject: "",
        message: "",
    });
    const [sending, setSending] = useState(false);

    // Data State
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [stores, setStores] = useState<Store[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);

    // Search / Filter
    const [searchQuery, setSearchQuery] = useState("");

    // Effects
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
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchData();
    };

    const toggleStoreStatus = async (storeId: string, currentStatus: boolean) => {
        if (!confirm(`Are you sure you want to ${currentStatus ? 'suspend' : 'activate'} this store?`)) return;
        try {
            const res = await adminApi.suspendStore(storeId, !currentStatus);
            if (res.data.success) fetchData();
        } catch (err) {
            console.error(err);
        }
    };

    const toggleSupplierStatus = async (supplierId: string, currentStatus: boolean) => {
        if (!confirm(`Are you sure you want to ${currentStatus ? 'suspend' : 'activate'} this supplier?`)) return;
        try {
            const res = await adminApi.suspendSupplier(supplierId, !currentStatus);
            if (res.data.success) fetchData();
        } catch (err) {
            console.error(err);
        }
    };

    const convertToSupplier = async (userId: string, username: string) => {
        if (!confirm(`Are you sure you want to convert user "${username}" to a Supplier? This will give them supplier access.`)) return;
        try {
            const res = await adminApi.convertToSupplier(userId);
            if (res.data) {
                alert(`User ${username} converted to supplier successfully.`);
                fetchData();
            }
        } catch (err: any) {
            console.error(err);
            alert("Error: " + err.message);
        }
    };

    const deleteUser = async (userId: string, username: string) => {
        if (!confirm(`Are you sure you want to PERMANENTLY DELETE user "${username}"? This action cannot be undone.`)) return;
        try {
            await adminApi.deleteUser(userId);
            alert(`User ${username} deleted successfully.`);
            fetchData();
        } catch (err: any) {
            console.error(err);
            alert("Error: " + err.message);
        }
    };

    const deleteStore = async (storeId: string, storeName: string) => {
        if (!confirm(`Are you sure you want to PERMANENTLY DELETE store "${storeName}"? This action cannot be undone.`)) return;
        try {
            await adminApi.deleteStore(storeId);
            alert(`Store ${storeName} deleted successfully.`);
            fetchData();
        } catch (err: any) {
            console.error(err);
            alert("Error: " + err.message);
        }
    };

    const deleteSupplier = async (supplierId: string, supplierName: string) => {
        if (!confirm(`Are you sure you want to PERMANENTLY DELETE supplier "${supplierName}"? This action cannot be undone.`)) return;
        try {
            await adminApi.deleteSupplier(supplierId);
            alert(`Supplier ${supplierName} deleted successfully.`);
            fetchData();
        } catch (err: any) {
            console.error(err);
            alert("Error: " + err.message);
        }
    };

    const handleLogout = () => {
        if (confirm("Are you sure you want to logout?")) {
            setAuth(clearAuthState());
            navigate("/login");
        }
    };

    const handleSendNotification = async (e: React.FormEvent) => {
        e.preventDefault();
        setSending(true);
        try {
            const res : any = await adminApi.sendNotification(notifyForm);
            if (res.data.success) {
                alert("Notification dispatched successfully!");
                setNotifyForm({ ...notifyForm, subject: "", message: "" });
            } else if (res.data.success == false) {
                alert(res.data.error)
            }
        } catch (err: any) {
            console.error(err);
            alert("Error sending notification: " + err.message);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                <Shield className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                                    Admin Console
                                </h1>
                                <p className="text-xs text-slate-500 font-medium">Global System Management</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg border border-slate-200/50">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-xs font-semibold text-slate-600 tracking-wide">SYSTEM ONLINE</span>
                            </div>
                            <div className="h-8 w-[1px] bg-slate-200" />
                            <div className="flex items-center gap-3">
                                <div className="text-right hidden sm:block">
                                    <p className="text-sm font-semibold text-slate-800">{auth.user?.username}</p>
                                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{auth.user?.globalRole}</p>
                                </div>
                                <div className="w-9 h-9 bg-slate-900 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                    {auth.user?.username?.charAt(0).toUpperCase()}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleLogout}
                                    className="ml-2 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                    title="Logout"
                                >
                                    <LogOut className="w-5 h-5" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex gap-1 mt-6 border-b border-slate-200 overflow-x-auto">
                        {(["overview", "analytics", "stores", "suppliers", "users", "notifications"] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => { setActiveTab(tab); setSearchQuery(""); }}
                                className={`px-4 py-2 text-sm font-medium relative transition-colors ${activeTab === tab ? "text-indigo-600" : "text-slate-500 hover:text-slate-800"
                                    }`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                {activeTab === tab && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"
                                    />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="max-w-7xl mx-auto px-6 py-8">
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
                                        <Button variant="ghost" size="sm" className="text-slate-400">View All</Button>
                                    </div>
                                    <div className="max-h-[400px] overflow-y-auto">
                                        {loading ? (
                                            <div className="p-8 text-center text-slate-400">Loading activity...</div>
                                        ) : stats?.recentActivity.length === 0 ? (
                                            <div className="p-8 text-center text-slate-400">No recent activity</div>
                                        ) : (
                                            stats?.recentActivity.map((act) => (
                                                <ActivityItem key={act.id} activity={act} />
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
                                        analytics.recentCriticalActivity.map((act) => (
                                            <ActivityItem key={act.id} activity={act} />
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
                                <form onSubmit={handleSearch} className="flex gap-2">
                                    <div className="relative">
                                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search stores..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
                                        />
                                    </div>
                                    <Button type="submit" variant="default" disabled={loading}>
                                        {loading ? "Searching..." : "Search"}
                                    </Button>
                                </form>
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
                                        {stores.map((store) => (
                                            <tr key={store.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 font-medium text-slate-900">{store.name}</td>
                                                <td className="px-6 py-4 text-slate-500 font-mono text-xs bg-slate-100/50 rounded px-2 w-fit">{store.slug}</td>
                                                <td className="px-6 py-4 text-slate-500">
                                                    {store.users?.[0]?.user?.email || "No Owner"}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <StatusBadge isActive={store.isActive || false} />
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className={store.isActive ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50" : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"}
                                                            onClick={() => toggleStoreStatus(store.id, store.isActive || false)}
                                                        >
                                                            {store.isActive ? "Suspend" : "Activate"}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                            onClick={() => deleteStore(store.id, store.name)}
                                                            title="Delete Store"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {!loading && stores.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                                    No stores found.
                                                </td>
                                            </tr>
                                        )}
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
                                <form onSubmit={handleSearch} className="flex gap-2">
                                    <div className="relative">
                                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search suppliers..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
                                        />
                                    </div>
                                    <Button type="submit" variant="default" disabled={loading}>
                                        {loading ? "Searching..." : "Search"}
                                    </Button>
                                </form>
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
                                        {suppliers.map((supplier) => (
                                            <tr key={supplier.id} className="hover:bg-slate-50 transition-colors">
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
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className={supplier.isActive ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50" : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"}
                                                            onClick={() => toggleSupplierStatus(supplier.id, supplier.isActive || false)}
                                                        >
                                                            {supplier.isActive ? "Suspend" : "Activate"}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                            onClick={() => deleteSupplier(supplier.id, supplier.name)}
                                                            title="Delete Supplier"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {!loading && suppliers.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                                    No suppliers found.
                                                </td>
                                            </tr>
                                        )}
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
                                <form onSubmit={handleSearch} className="flex gap-2">
                                    <div className="relative">
                                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search users..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
                                        />
                                    </div>
                                    <Button type="submit" variant="default" disabled={loading}>
                                        {loading ? "Searching..." : "Search"}
                                    </Button>
                                </form>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="px-6 py-4 font-semibold text-slate-700">Username</th>
                                            <th className="px-6 py-4 font-semibold text-slate-700">Email</th>
                                            <th className="px-6 py-4 font-semibold text-slate-700">Role</th>
                                            <th className="px-6 py-4 font-semibold text-slate-700">Joined</th>
                                            <th className="px-6 py-4 font-semibold text-slate-700 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {users.map((user) => (
                                            <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 font-medium text-slate-900">{user.username}</td>
                                                <td className="px-6 py-4 text-slate-500">{user.email}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.globalRole === 'SUPERADMIN'
                                                        ? "bg-purple-100 text-purple-800"
                                                        : user.globalRole === 'SUPPLIER'
                                                            ? "bg-emerald-100 text-emerald-800"
                                                            : "bg-slate-100 text-slate-800"
                                                        }`}>
                                                        {user.globalRole || "USER"}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-slate-500">Joined: {new Date(user.createdAt || "").toLocaleDateString()}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {user.globalRole !== 'SUPPLIER' && user.globalRole !== 'SUPERADMIN' && (
                                                            <Button
                                                                variant="default"
                                                                size="sm"
                                                                className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 border border-indigo-200"
                                                                onClick={() => convertToSupplier(user.id, user.username)}
                                                            >
                                                                Convert to Supplier
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                            onClick={() => deleteUser(user.id, user.username)}
                                                            title="Delete User"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {!loading && users.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                                    No users found.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === "notifications" && (
                        <motion.div
                            key="notifications"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-8"
                        >
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
                                    <AlertTriangle className="w-6 h-6 text-indigo-600" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">Send System Notification</h2>
                                    <p className="text-sm text-slate-500">Dispatch alerts to users via Dashboard or Email</p>
                                </div>
                            </div>

                            <form onSubmit={handleSendNotification} className="space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Target Audience</label>
                                        <select
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={notifyForm.targetRole}
                                            onChange={e => setNotifyForm({ ...notifyForm, targetRole: e.target.value })}
                                        >
                                            <option value="ALL">All Users</option>
                                            <option value="SUPPLIER">Suppliers Only</option>
                                            <option value="STORE_OWNER">Store Owners Only</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Delivery Method</label>
                                        <select
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={notifyForm.type}
                                            onChange={e => setNotifyForm({ ...notifyForm, type: e.target.value as any })}
                                        >
                                            <option value="SYSTEM">System Notification (In-App)</option>
                                            <option value="EMAIL">Email Only</option>
                                            <option value="BOTH">Both (System + Email)</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Subject / Title</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="e.g. Scheduled Maintenance"
                                        value={notifyForm.subject}
                                        onChange={e => setNotifyForm({ ...notifyForm, subject: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Message Body</label>
                                    <textarea
                                        required
                                        rows={5}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="Type your message here..."
                                        value={notifyForm.message}
                                        onChange={e => setNotifyForm({ ...notifyForm, message: e.target.value })}
                                    />
                                    <p className="text-xs text-slate-400 mt-2">HTML is supported for Emails.</p>
                                </div>

                                <div className="flex justify-end pt-4">
                                    <Button
                                        type="submit"
                                        disabled={sending}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-8"
                                    >
                                        {sending ? "Sending..." : "Dispatch Notification"}
                                    </Button>
                                </div>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};

export default SuperAdminDashboard;
