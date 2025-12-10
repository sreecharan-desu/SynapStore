// src/pages/StoreOwnerDashboard.tsx
import React from "react";
import { useRecoilValue } from "recoil";
import { authState } from "../state/auth";
import { motion } from "framer-motion";
import { Store, ShoppingCart, TrendingUp, Users, Package, DollarSign, Activity, LogOut, Truck, Check, X } from "lucide-react";
import { useLogout } from "../hooks/useLogout";
import { dashboardApi } from "../lib/api/endpoints";
import { Button } from "../components/ui/button";
import type { SupplierRequest, Supplier } from "../lib/types";

interface DashboardData {
    user: any;
    store: any;
    overview: {
        totalMedicines: number;
        totalBatches: number;
        recentSalesCount: number;
        recentRevenue: number;
        unreadNotifications: number;
        inventoryTotals: {
            qtyAvailable: number;
        };
    };
    charts: {
        salesByDay: Array<{ date: string; revenue: number; count: number }>;
        topMovers: Array<{ medicineId: string; medicine: { brandName: string }; qtySold: number }>;
    };
    lists: {
        lowStock: Array<any>;
        recentSales: Array<any>;
        activity: Array<{ id: string; action: string; createdAt: string }>;
        suppliers: Array<Supplier>;
    };
}

const StoreOwnerDashboard: React.FC = () => {
    const auth = useRecoilValue(authState);
    const logout = useLogout();

    const [data, setData] = React.useState<DashboardData | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [supplierRequests, setSupplierRequests] = React.useState<SupplierRequest[]>([]);

    React.useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const [, bootstrapRes, requestsRes] = await Promise.all([
                    dashboardApi.getStore(), // just to ensure permissions/context
                    dashboardApi.getBootstrap(),
                    dashboardApi.getSupplierRequests()
                ]);

                if (bootstrapRes.data.success) {
                    setData(bootstrapRes.data.data);
                }

                if (requestsRes.data.success && Array.isArray(requestsRes.data.data)) {
                    setSupplierRequests(requestsRes.data.data);
                }
            } catch (err) {
                console.error("Failed to fetch dashboard data", err);
            } finally {
                setLoading(false);
            }
        };

        if (auth.token) {
            fetchDashboardData();
        }
    }, [auth.token]);

    const handleLogout = () => {
        if (confirm("Are you sure you want to logout?")) {
            logout();
        }
    };

    const handleAcceptRequest = async (requestId: string) => {
        if (!confirm("Accept this supplier request?")) return;
        try {
            const res = await dashboardApi.acceptSupplierRequest(requestId);
            if (res.data.success) {
                alert("Request accepted!");
                // Refresh data
                window.location.reload();
            }
        } catch (err) {
            console.error(err);
            alert("Failed to accept");
        }
    };

    const handleRejectRequest = async (requestId: string) => {
        if (!confirm("Reject this supplier request?")) return;
        try {
            const res = await dashboardApi.rejectSupplierRequest(requestId);
            if (res.data.success) {
                alert("Request rejected");
                // Refresh data
                window.location.reload();
            }
        } catch (err) {
            console.error(err);
            alert("Failed to reject");
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-50">Loading dashboard...</div>;
    }

    const stats = [
        { icon: DollarSign, label: "Revenue (30d)", value: `$${data?.overview.recentRevenue.toLocaleString() ?? '0'}`, color: "from-emerald-500 to-teal-500", change: "" },
        { icon: ShoppingCart, label: "Sales (30d)", value: data?.overview.recentSalesCount.toString() ?? "0", color: "from-blue-500 to-cyan-500", change: "" },
        { icon: Package, label: "Low Stock", value: data?.lists.lowStock.length.toString() ?? "0", color: "from-orange-500 to-red-500", change: "Action needed" },
        { icon: Users, label: "Suppliers", value: data?.lists.suppliers.length.toString() ?? "0", color: "from-purple-500 to-pink-500", change: "" },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-100">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-xl border-b border-emerald-200/50 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg">
                                <Store className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                                    {auth.effectiveStore?.name || "Store Dashboard"}
                                </h1>
                                <p className="text-sm text-slate-500">Welcome back, {auth.user?.username}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-xl text-sm font-medium">
                                {auth.user?.globalRole}
                            </div>
                            <button
                                onClick={handleLogout}
                                className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-colors"
                                title="Logout"
                            >
                                <LogOut className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {stats.map((stat, idx) => (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center`}>
                                    <stat.icon className="w-6 h-6 text-white" />
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                                    <p className="text-xs text-slate-500">{stat.label}</p>
                                </div>
                            </div>
                            {stat.change && (
                                <div className="flex items-center gap-1 text-xs text-emerald-600">
                                    <TrendingUp className="w-3 h-3" />
                                    <span>{stat.change}</span>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>



                {/* Recent Activity */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl p-8 shadow-lg"
                >
                    <h2 className="text-xl font-bold text-slate-800 mb-6">Recent Activity</h2>
                    <div className="space-y-4">
                        {data?.lists.activity && data.lists.activity.length > 0 ? (
                            data.lists.activity.map((log) => (
                                <div key={log.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                            <Activity className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-800">{log.action.replace(/_/g, " ")}</p>
                                            <p className="text-xs text-slate-500">{new Date(log.createdAt).toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Activity className="w-8 h-8 text-emerald-600" />
                                </div>
                                <p className="text-slate-500">No recent activity</p>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Supplier Requests */}
                {supplierRequests.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-6 bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl p-8 shadow-lg"
                    >
                        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <Truck className="w-5 h-5 text-indigo-600" />
                            Pending Supplier Requests
                        </h2>
                        <div className="space-y-3">
                            {supplierRequests.map((req) => (
                                <div key={req.id} className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                                    <div>
                                        <p className="font-semibold text-slate-800">{req.supplier?.name || "Unknown Supplier"}</p>
                                        <p className="text-sm text-slate-500">Wants to connect with your store</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            onClick={() => handleAcceptRequest(req.id)}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                        >
                                            <Check className="w-4 h-4 mr-1" /> Accept
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleRejectRequest(req.id)}
                                            className="text-red-600 border-red-200 hover:bg-red-50"
                                        >
                                            <X className="w-4 h-4 mr-1" /> Reject
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}


            </div>
        </div>
    );
};

export default StoreOwnerDashboard;
