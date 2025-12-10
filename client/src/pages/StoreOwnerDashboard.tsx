// src/pages/StoreOwnerDashboard.tsx
import React, { useState, useRef } from "react";
import { useRecoilValue, useSetRecoilState } from "recoil";
import { authState, clearAuthState } from "../state/auth";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Store, ShoppingCart, Package, DollarSign, AlertCircle, RefreshCw, LogOut } from "lucide-react";
import { useDashboardData } from "../hooks/useDashboardData";
import ChatbotIcon from "../components/chat/ChatbotIcon";
import ChatbotOverlay from "../components/chat/ChatbotOverlay";

const formatNumber = (n: number | null | undefined) =>
    n == null ? "0" : n.toLocaleString();

const formatCurrency = (n: number | null | undefined, currency: string = "INR") => {
    const value = n == null ? 0 : n;
    const symbol = currency === "INR" ? "₹" : "$";
    return `${symbol}${value.toLocaleString()}`;
};

const EmptyState = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div className="flex flex-col items-center justify-center text-center text-slate-600 py-8">
        <p className="text-lg font-semibold text-slate-900">{title}</p>
        {subtitle && <p className="text-sm mt-1 text-slate-600">{subtitle}</p>}
    </div>
);

const StoreOwnerDashboard: React.FC = () => {
    const auth = useRecoilValue(authState);
    const setAuth = useSetRecoilState(authState);
    const navigate = useNavigate();
    const { data, loading, error, refresh } = useDashboardData();
    const [chatOpen, setChatOpen] = useState(false);
    const chatIconRef = useRef<HTMLButtonElement>(null);

    const handleLogout = () => {
        setAuth(clearAuthState());
        navigate("/login");
    };

    const overview = data?.overview;
    const store = data?.store;
    const lists = data?.lists;

    const stats = [
        {
            icon: DollarSign,
            label: "Recent Revenue",
            value: formatCurrency(overview?.recentRevenue, store?.currency),
            color: "from-emerald-500 to-teal-500",
            hint: `${formatNumber(overview?.recentSalesCount)} sales`
        },
        {
            icon: Package,
            label: "Medicines",
            value: formatNumber(overview?.totalMedicines),
            color: "from-blue-500 to-cyan-500",
            hint: `${formatNumber(overview?.totalBatches)} batches`
        },
        {
            icon: AlertCircle,
            label: "Active Alerts",
            value: formatNumber(overview?.totalActiveAlerts),
            color: "from-amber-500 to-orange-500",
            hint: `${formatNumber(overview?.unreadNotifications)} notifications`
        },
        {
            icon: ShoppingCart,
            label: "Pending Reorders",
            value: formatNumber(overview?.totalPendingReorders),
            color: "from-purple-500 to-pink-500",
            hint: `Webhook failures: ${formatNumber(overview?.webhookFailures)}`
        },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-100 relative">
            {/* Animated Background Elements */}
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

            {/* Header */}
            <div className="bg-white/80 backdrop-blur-xl border-b border-emerald-200/50 sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <motion.div
                                whileHover={{ scale: 1.05, rotate: 5 }}
                                className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg"
                            >
                                <Store className="w-6 h-6 text-white" />
                            </motion.div>
                            <div>
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                                    {store?.name || "Store Dashboard"}
                                </h1>
                                <p className="text-sm text-slate-500">Welcome back, {auth.user?.username}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={refresh}
                                disabled={loading}
                                className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-xl text-sm font-medium hover:bg-emerald-200 transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                {loading ? "Refreshing..." : "Refresh"}
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleLogout}
                                className="px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-colors flex items-center gap-2"
                            >
                                <LogOut className="w-4 h-4" />
                                Logout
                            </motion.button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-8 relative z-10">
                {/* Error State */}
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-900"
                    >
                        {error}
                    </motion.div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {stats.map((stat, idx) => (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            // @ts-ignore
                            whileHover={{ y: -5, shadow: "0 20px 40px rgba(0,0,0,0.1)" }}
                            className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center shadow-md`}>
                                    <stat.icon className="w-6 h-6 text-white" />
                                </div>
                            </div>
                            <p className="text-2xl font-bold text-slate-800 mb-1">{stat.value}</p>
                            <p className="text-sm text-slate-600 mb-2">{stat.label}</p>
                            {stat.hint && (
                                <p className="text-xs text-slate-500">{stat.hint}</p>
                            )}
                        </motion.div>
                    ))}
                </div>

                {/* Charts & Lists Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {/* Low Stock */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-lg"
                    >
                        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Package className="w-5 h-5 text-amber-600" />
                            Low Stock
                        </h2>
                        {lists?.lowStock?.length ? (
                            <div className="space-y-2 max-h-64 overflow-auto pr-1">
                                {lists.lowStock.slice(0, 5).map((b: any) => (
                                    <div
                                        key={b.id}
                                        className="flex items-center justify-between text-sm bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl px-4 py-3 border border-amber-200/50"
                                    >
                                        <div>
                                            <p className="font-medium text-slate-900">{b.medicine?.brandName ?? "Unknown"}</p>
                                            <p className="text-slate-600 text-xs">Batch {b.batchNumber}</p>
                                        </div>
                                        <p className="text-amber-600 font-semibold">
                                            Qty {formatNumber(b.qtyAvailable ?? 0)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <EmptyState title="Stock looks good" subtitle="Add inventory to monitor low-stock alerts." />
                        )}
                    </motion.div>

                    {/* Expiries Soon */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-lg"
                    >
                        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                            Expiries Soon
                        </h2>
                        {lists?.expiries?.length ? (
                            <div className="space-y-2 max-h-64 overflow-auto pr-1">
                                {lists.expiries.slice(0, 5).map((b: any) => (
                                    <div
                                        key={b.id}
                                        className="flex items-center justify-between text-sm bg-gradient-to-br from-red-50 to-pink-50 rounded-xl px-4 py-3 border border-red-200/50"
                                    >
                                        <div>
                                            <p className="font-medium text-slate-900">{b.medicine?.brandName ?? "Unknown"}</p>
                                            <p className="text-slate-600 text-xs">Batch {b.batchNumber}</p>
                                        </div>
                                        <p className="text-red-600 font-semibold text-xs">
                                            {b.expiryDate ? new Date(b.expiryDate).toISOString().slice(0, 10) : "—"}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <EmptyState title="No expiries near-term" subtitle="Upcoming expiries will show up here." />
                        )}
                    </motion.div>
                </div>

                {/* Recent Sales */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-lg"
                >
                    <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5 text-emerald-600" />
                        Recent Sales
                    </h2>
                    {lists?.recentSales?.length ? (
                        <div className="overflow-auto">
                            <table className="min-w-full text-sm">
                                <thead className="text-slate-600 border-b border-slate-200">
                                    <tr>
                                        <th className="text-left pb-3 pr-4 font-semibold">Date</th>
                                        <th className="text-left pb-3 pr-4 font-semibold">Value</th>
                                        <th className="text-left pb-3 pr-4 font-semibold">Status</th>
                                        <th className="text-left pb-3 pr-4 font-semibold">Items</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lists.recentSales.slice(0, 10).map((s: any) => (
                                        <tr key={s.id} className="border-t border-slate-100 hover:bg-emerald-50/50 transition-colors">
                                            <td className="py-3 pr-4 text-slate-700">
                                                {new Date(s.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="py-3 pr-4 text-emerald-600 font-semibold">
                                                {formatCurrency(s.totalValue ?? 0, store?.currency)}
                                            </td>
                                            <td className="py-3 pr-4">
                                                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium">
                                                    {s.paymentStatus}
                                                </span>
                                            </td>
                                            <td className="py-3 pr-4 text-slate-700">
                                                {s.items?.length ?? 0} items
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <EmptyState title="No sales yet" subtitle="Record your first sale to see activity here." />
                    )}
                </motion.div>

                {/* Info Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="mt-6 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-8 text-white shadow-xl"
                >
                    <h3 className="text-2xl font-bold mb-2">Store Management</h3>
                    <p className="text-emerald-100">
                        Manage your inventory, track sales, and grow your business with powerful analytics and insights.
                    </p>
                </motion.div>
            </div>

            {/* Chatbot */}
            <>
                <ChatbotIcon
                    onClick={() => setChatOpen(true)}
                    ref={chatIconRef}
                />
                <ChatbotOverlay
                    open={chatOpen}
                    onClose={() => setChatOpen(false)}
                    iconButtonRef={chatIconRef}
                />
            </>
        </div>
    );
};

export default StoreOwnerDashboard;
