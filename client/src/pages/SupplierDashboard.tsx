// src/pages/SupplierDashboard.tsx
import React from "react";
import { useRecoilValue } from "recoil";
import { authState } from "../state/auth";
import { motion } from "framer-motion";
import { Package, TruckIcon, FileText, DollarSign, Clock, CheckCircle } from "lucide-react";

const SupplierDashboard: React.FC = () => {
    const auth = useRecoilValue(authState);

    const stats = [
        { icon: Package, label: "Products Supplied", value: "0", color: "from-emerald-500 to-teal-500" },
        { icon: TruckIcon, label: "Pending Orders", value: "0", color: "from-blue-500 to-cyan-500" },
        { icon: FileText, label: "Invoices", value: "0", color: "from-purple-500 to-pink-500" },
        { icon: DollarSign, label: "Total Revenue", value: "$0", color: "from-orange-500 to-red-500" },
    ];

    const recentOrders = [
        // Placeholder data
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-100">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-xl border-b border-emerald-200/50 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg">
                                <TruckIcon className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                                    Supplier Dashboard
                                </h1>
                                <p className="text-sm text-slate-500">Welcome back, {auth.user?.username}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-xl text-sm font-medium">
                                {auth.user?.globalRole}
                            </div>
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
                        </motion.div>
                    ))}
                </div>

                {/* Quick Actions */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl p-8 shadow-lg mb-6"
                >
                    <h2 className="text-xl font-bold text-slate-800 mb-6">Quick Actions</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/50 rounded-xl text-left hover:shadow-lg transition-all group">
                            <Package className="w-8 h-8 text-emerald-600 mb-2 group-hover:scale-110 transition-transform" />
                            <h3 className="font-semibold text-slate-800">My Products</h3>
                            <p className="text-sm text-slate-500 mt-1">View and manage products</p>
                        </button>
                        <button className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200/50 rounded-xl text-left hover:shadow-lg transition-all group">
                            <Clock className="w-8 h-8 text-blue-600 mb-2 group-hover:scale-110 transition-transform" />
                            <h3 className="font-semibold text-slate-800">Pending Orders</h3>
                            <p className="text-sm text-slate-500 mt-1">Review pending orders</p>
                        </button>
                        <button className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200/50 rounded-xl text-left hover:shadow-lg transition-all group">
                            <FileText className="w-8 h-8 text-purple-600 mb-2 group-hover:scale-110 transition-transform" />
                            <h3 className="font-semibold text-slate-800">Invoices</h3>
                            <p className="text-sm text-slate-500 mt-1">View invoices and payments</p>
                        </button>
                    </div>
                </motion.div>

                {/* Recent Orders */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl p-8 shadow-lg"
                >
                    <h2 className="text-xl font-bold text-slate-800 mb-6">Recent Orders</h2>
                    {recentOrders.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-8 h-8 text-emerald-600" />
                            </div>
                            <p className="text-slate-500">No recent orders</p>
                            <p className="text-sm text-slate-400 mt-1">Orders from stores will appear here</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Order items will be mapped here */}
                        </div>
                    )}
                </motion.div>

                {/* Info Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="mt-6 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-8 text-white shadow-xl"
                >
                    <h3 className="text-2xl font-bold mb-2">Supplier Portal</h3>
                    <p className="text-emerald-100">
                        Manage your product catalog, track orders, and view payment information all in one place.
                    </p>
                </motion.div>
            </div>
        </div>
    );
};

export default SupplierDashboard;
