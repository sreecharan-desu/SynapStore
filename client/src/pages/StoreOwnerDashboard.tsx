import React from "react";
import { useRecoilValue } from "recoil";
import { authState } from "../state/auth";
import { motion, AnimatePresence } from "framer-motion";
import {  Bell, Settings, LogOut, Users, Package,  Calendar,  Search,  X, Sparkles, Lock, Truck, Zap, Check, FileText, ChevronDown, ChevronUp, Activity, ShoppingCart, Link, Store } from "lucide-react";

import { formatDistanceToNow } from "date-fns";
import { useLogout } from "../hooks/useLogout";
import { dashboardApi } from "../lib/api/endpoints";
import { Button } from "../components/ui/button";
import type { SupplierRequest, Supplier } from "../lib/types";
import FeedbackToast from "../components/ui/feedback-toast";
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "../components/ui/card";
import {
    type ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "../components/ui/line-chart";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../components/ui/select";
import { FaRupeeSign } from "react-icons/fa";

const Skeleton = ({ className }: { className?: string }) => (
    <div className={`animate-pulse bg-slate-200 rounded-md ${className}`} />
);

const chartConfig = {
    revenue: {
        label: "Revenue",
        color: "#059669", // emerald-600
    },
} satisfies ChartConfig;

const themeConfig: Record<string, {
    primary: string;
    light: string;
    text: string;
    border: string;
    ring: string;
    gradient: string;
    shadow: string;
    icon: string;
    hex: string;
}> = {
    green: {
        primary: "bg-emerald-500",
        light: "bg-emerald-50",
        text: "text-emerald-600",
        border: "border-emerald-500",
        ring: "ring-emerald-500",
        gradient: "from-emerald-500 to-emerald-700",
        shadow: "shadow-emerald-500/20",
        icon: "text-emerald-50",
        hex: "#10b981",
    },
    red: {
        primary: "bg-red-600",
        light: "bg-red-50",
        text: "text-red-700",
        border: "border-red-600",
        ring: "ring-red-600",
        gradient: "from-red-600 to-red-800",
        shadow: "shadow-red-600/20",
        icon: "text-red-50",
        hex: "#dc2626",
    },
    orange: {
        primary: "bg-orange-500",
        light: "bg-orange-50",
        text: "text-orange-600",
        border: "border-orange-500",
        ring: "ring-orange-500",
        gradient: "from-orange-500 to-orange-700",
        shadow: "shadow-orange-500/20",
        icon: "text-orange-50",
        hex: "#f97316",
    },
    blue: {
        primary: "bg-blue-600",
        light: "bg-blue-50",
        text: "text-blue-700",
        border: "border-blue-600",
        ring: "ring-blue-600",
        gradient: "from-blue-600 to-blue-800",
        shadow: "shadow-blue-600/20",
        icon: "text-blue-50",
        hex: "#2563eb",
    },
    black: {
        primary: "bg-slate-900",
        light: "bg-slate-100",
        text: "text-slate-900",
        border: "border-slate-900",
        ring: "ring-slate-900",
        gradient: "from-slate-900 to-slate-800",
        shadow: "shadow-slate-900/20",
        icon: "text-slate-50",
        hex: "#0f172a",
    },
};

const avatarsMap: Record<string, string> = {
    "fruit-strawberry": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f353.svg",
    "fruit-pineapple": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f34d.svg",
    "fruit-watermelon": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f349.svg",
    "fruit-grapes": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f347.svg",
};

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
        topMovers: Array<{
            medicineId: string;
            medicine: { brandName: string };
            qtySold: number;
        }>;
    };
    lists: {
        lowStock: Array<any>;
        recentSales: Array<any>;
        activity: Array<{ id: string; action: string; createdAt: string }>;
        suppliers: Array<Supplier>;
    };
}

const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
};

const getActivityConfig = (action: string) => {
    const lower = action.toLowerCase();
    if (lower.includes('sale') || lower.includes('order')) return { icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' };
    if (lower.includes('login') || lower.includes('auth')) return { icon: Lock, color: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-emerald-200' };
    if (lower.includes('stock') || lower.includes('inventory') || lower.includes('product')) return { icon: Package, color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-200' };
    if (lower.includes('setting') || lower.includes('update')) return { icon: Settings, color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200' };
    if (lower.includes('supplier') || lower.includes('request') || lower.includes('connect')) return { icon: Link, color: 'text-indigo-600', bg: 'bg-indigo-100', border: 'border-indigo-200' };
    return { icon: Zap, color: 'text-violet-600', bg: 'bg-violet-100', border: 'border-violet-200' };
};

const StoreOwnerDashboard: React.FC = () => {
    const auth = useRecoilValue(authState);
    const logout = useLogout();

    const [data, setData] = React.useState<DashboardData | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [supplierRequests, setSupplierRequests] = React.useState<SupplierRequest[]>([]);
    const [myRequests, setMyRequests] = React.useState<SupplierRequest[]>([]);
    const [showNotifications, setShowNotifications] = React.useState(false);
    const [showFeedback, setShowFeedback] = React.useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
    const [isActivityExpanded, setIsActivityExpanded] = React.useState(false);
    const [selectedPeriod, setSelectedPeriod] = React.useState('7d');
    const notificationRef = React.useRef<HTMLDivElement>(null);
    const [selectedTheme, setSelectedTheme] = React.useState("green");
    const [selectedAvatar, setSelectedAvatar] = React.useState("fruit-strawberry");

    // Reorder State
    const [reorderModalOpen, setReorderModalOpen] = React.useState(false);
    const [inventoryList, setInventoryList] = React.useState<any[]>([]);
    const [cart, setCart] = React.useState<Map<string, number>>(new Map()); // medicineId -> qty
    const [reorderSupplierId, setReorderSupplierId] = React.useState<string>("");
    const [reorderNote, setReorderNote] = React.useState("");
    const [isAiLoading, setIsAiLoading] = React.useState(false);

    const handleOpenReorder = async () => {
        setReorderModalOpen(true);
        try {
            const res = await dashboardApi.getInventory();
            if (res.data.success) {
                setInventoryList(res.data.data.inventory);
            }
        } catch (err) {
            console.error("Failed to fetch inventory for reorder", err);
        }
    };

    const handleAddToCart = (medicineId: string, qty: number) => {
        setCart(prev => {
            const newCart = new Map(prev);
            if (qty <= 0) newCart.delete(medicineId);
            else newCart.set(medicineId, qty);
            return newCart;
        });
    };

    const submitReorder = async () => {
        if (!reorderSupplierId) {
            alert("Please select a supplier.");
            return;
        }
        if (cart.size === 0) {
            alert("Please add items to reorder.");
            return;
        }

        const items = Array.from(cart.entries()).map(([medicineId, quantity]) => ({
            medicineId,
            quantity
        }));

        try {
            const res = await dashboardApi.reorder({
                supplierId: reorderSupplierId,
                items,
                note: reorderNote
            });
            if (res.data.success) {
                alert("Reorder request sent successfully!");
                setReorderModalOpen(false);
                setCart(new Map());
                setReorderNote("");
                setReorderSupplierId("");
            }
        } catch (err: any) {
            console.error(err);
            alert("Failed to send reorder: " + err.message);
        }
    };

    const handleSmartFill = async () => {
        setIsAiLoading(true);
        // Simulate AI thinking time
        await new Promise(resolve => setTimeout(resolve, 1500));

        try {
            const res = await dashboardApi.getSuggestions();
            if (res.data.success) {
                const suggestions = res.data.data.suggestions;
                if (suggestions.length === 0) {
                    alert("No low stock items found.");
                    setIsAiLoading(false);
                    return;
                }
                
                // Auto-fill Cart
                setCart(prev => {
                   const newCart = new Map(prev);
                   suggestions.forEach((s: any) => {
                       newCart.set(s.medicineId, s.suggestedQty);
                   });
                   return newCart;
                });

                // Auto-select Supplier (Pick first available if not set)
                if (!reorderSupplierId && data?.lists?.suppliers?.length) {
                    setReorderSupplierId(data.lists.suppliers[0].id);
                }

                // Auto-fill Note with "AI" message
                const storeName = data?.store?.name || "Our Pharmacy";
                const aiNote = `Hello,\n\nI would like to place an urgent restock request for ${suggestions.length} items for ${storeName}. Please prioritize immediate dispatch.\n\nGenerated by SynapStore AI 🤖`;
                setReorderNote(aiNote);
            }
        } catch (err) {
            console.error("Failed to get suggestions", err);
        } finally {
            setIsAiLoading(false);
        }
    };

    // Load theme/avatar
    React.useEffect(() => {
        const t = localStorage.getItem("selectedTheme");
        const a = localStorage.getItem("selectedAvatar");
        if (t) setSelectedTheme(t);
        if (a) setSelectedAvatar(a);
    }, []);

    const theme = themeConfig[selectedTheme] || themeConfig.green;

    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setShowNotifications(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const fetchData = React.useCallback(async () => {
        try {
            const [, bootstrapRes, requestsRes] = await Promise.all([
                dashboardApi.getStore(),
                dashboardApi.getBootstrap(),
                dashboardApi.getSupplierRequests(),
            ]);

            if (bootstrapRes.data.success) {
                setData(bootstrapRes.data.data);
            }

            if (requestsRes.data.success && Array.isArray(requestsRes.data.data)) {
                // Filter notifications: Only show INBOUND requests (Requests created by the Supplier, i.e., NOT by me)
                // Actually, more accurately: Requests where createdById is NOT the current user
                // Or better: Requests where the direction is Incoming.
                // Since we don't have strict direction field in SupplierRequest type here, rely on createdById vs auth.user.id
                // But wait, if Self-Connect, createdById matches user (who is both Store Owner and Supplier).
                // If I am Store Owner, and I see a request I created, it's Outbound (except for Self-Connect where backend says Inbound?).
                // Backend logic: If CreatedBy == Supplier.userId -> Inbound.
                // Here we just want to avoid showing "You sent a request" as a notification to yourself.
                // So filter: remove requests created by ME.
                // UNLESS it's a self-request that is treated as Inbound?
                // Let's stick to: If createdById != auth.user?.id, show notification.
                // If I sent it, I don't need a notification.
                const allRequests = requestsRes.data.data;
                const inbound = allRequests.filter((r: SupplierRequest) => r.createdById !== auth.user?.id && r.status === 'PENDING');
                setSupplierRequests(inbound);
                
                // Also track my sent requests/reorders
                const outbound = allRequests.filter((r: SupplierRequest) => r.createdById === auth.user?.id);
                setMyRequests(outbound);
            }
        } catch (err) {
            console.error("Failed to fetch dashboard data", err);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        if (auth.token) {
            fetchData();
        }
    }, [auth.token, fetchData]);

    // Directory State
    const [showDirectory, setShowDirectory] = React.useState(false);
    const [directorySuppliers, setDirectorySuppliers] = React.useState<any[]>([]);

    const fetchSuppliersDirectory = React.useCallback(async (q?: string) => {
        try {
            const res = await dashboardApi.suppliersDirectory(q);
            if (res.data.success) {
                setDirectorySuppliers(res.data.data.suppliers);
            }
        } catch (err) {
            console.error(err);
        }
    }, []);

    React.useEffect(() => {
        if (showDirectory) fetchSuppliersDirectory();
    }, [showDirectory, fetchSuppliersDirectory]);

    const handleLogout = () => {
        setShowLogoutConfirm(true);
    };

    const handleAcceptRequest = async (requestId: string) => {
        // Optimistic update
        setSupplierRequests(prev => prev.filter(req => req.id !== requestId));
        try {
            await dashboardApi.acceptSupplierRequest(requestId);
            setShowFeedback(true);
        } catch (err) {
            console.error(err);
            // Revert on failure (optional, but good practice. For now simpler: alert)
            alert("Failed to accept");
            // refresh to be safe
            window.location.reload();
        }
    };

    const handleRejectRequest = async (requestId: string) => {
        if (!confirm("Reject this supplier request?")) return;
        setSupplierRequests(prev => prev.filter(req => req.id !== requestId));
        try {
            await dashboardApi.rejectSupplierRequest(requestId);
            setShowFeedback(true);
        } catch (err) {
            console.error(err);
            alert("Failed to reject");
        }
    };

    const handleDisconnectSupplier = async (supplierId: string) => {
        if (!confirm("Are you sure you want to disconnect this supplier?")) return;
        try {
            await dashboardApi.disconnectSupplier(supplierId);
            // Optimistically update lists.suppliers
            setData(prev => prev ? {
                ...prev,
                lists: {
                    ...prev.lists,
                    suppliers: prev.lists.suppliers.filter(s => s.id !== supplierId)
                }
            } : null);
            setShowFeedback(true);
        } catch (err) {
            console.error("Failed to disconnect", err);
            alert("Failed to disconnect supplier");
        }
    };



    const handleDirectoryAccept = async (requestId: string) => {
        try {
            // Optimistic update
            setDirectorySuppliers(prev => prev.map(s => s.requestId === requestId ? { ...s, connectionStatus: "CONNECTED" } : s));
            await dashboardApi.acceptSupplierRequest(requestId);
            setShowFeedback(true);
            fetchData();
        } catch (err) {
            console.error(err);
            alert("Failed to accept request");
            // Revert on error? Or just reload
            fetchSuppliersDirectory();
        }
    };

    const handleDirectoryReject = async (requestId: string) => {
        if (!confirm("Reject this request?")) return;
        try {
            setDirectorySuppliers(prev => prev.map(s => s.requestId === requestId ? { ...s, connectionStatus: "NONE", requestId: null } : s));
            await dashboardApi.rejectSupplierRequest(requestId);
            setShowFeedback(true);
            fetchData();
        } catch (err) {
            console.error(err);
            alert("Failed to reject request");
            fetchSuppliersDirectory();
        }
    };

    const handleConnectRequest = async (supplierId: string) => {
        try {
            await dashboardApi.createSupplierRequest({ supplierId });
            // Optimistic update
            setDirectorySuppliers(prev => prev.map(s => s.id === supplierId ? { ...s, connectionStatus: "PENDING" } : s));
            setShowFeedback(true);
        } catch (err) {
            console.error(err);
            alert("Failed to send request");
        }
    };





    if (loading) {
        return (
            <div className={`min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4`}>
                <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${theme.border}`}></div>
                <p className="text-slate-500 font-medium animate-pulse">
                    Getting things ready...
                </p>
            </div>
        );
    }

    const stats = [
        {
            icon: FaRupeeSign,
            label: "Revenue (30d)",
            value: `₹${data?.overview.recentRevenue.toLocaleString() ?? "0"}`,
            color: theme.primary,
            bg: theme.light,
            text: theme.text,
            change: "+12.5%", // Placeholder for "human" feel if backend doesn't provide
        },
        {
            icon: ShoppingCart,
            label: "Sales (30d)",
            value: data?.overview.recentSalesCount.toString() ?? "0",
            color: theme.primary,
            bg: theme.light,
            text: theme.text,
            change: "+4.3%",
        },
        {
            icon: Package,
            label: "Low Stock",
            value: data?.lists.lowStock.length.toString() ?? "0",
            color: theme.primary,
            bg: theme.light,
            text: theme.text,
            change: data?.lists.lowStock.length ? "Action needed" : "Healthy",
        },
        {
            icon: Users,
            label: "Suppliers",
            value: data?.lists.suppliers.length.toString() ?? "0",
            color: theme.primary,
            bg: theme.light,
            text: theme.text,
            change: "Active",
        },
    ];

    return (
        <div className="min-h-screen relative bg-slate-50/50">

            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200/60 transition-all duration-300">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between gap-8">
                    {/* Left: Brand & Store Info */}
                    <div className="flex items-center gap-4 shrink-0">
                        <div className={`w-12 h-12 ${theme.light} rounded-2xl flex items-center justify-center shadow-lg ${theme.shadow} overflow-hidden border-2 border-white`}>
                            {/* Avatar or Default Icon */}
                            {avatarsMap[selectedAvatar] ? (
                                <img src={avatarsMap[selectedAvatar]} alt="Store Avatar" className="w-8 h-8 object-contain drop-shadow-sm" />
                            ) : (
                                <Store className={`w-6 h-6 ${theme.text}`} />
                            )}
                        </div>
                        <div className="flex flex-col">
                            <h1 className="font-bold text-lg text-slate-800 tracking-tight leading-none">
                                {auth.effectiveStore?.name}
                            </h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${theme.text} opacity-80`}>
                                    {auth.user?.globalRole} Dashboard
                                </span>
                            </div>
                        </div>
                    </div>

             

                    {/* Right: Actions */}
                    <div className="flex items-center gap-3 shrink-0">
                        {/* Reorder Button */}
                        <Button 
                            onClick={handleOpenReorder}
                            className="bg-slate-900 text-white hover:bg-slate-800 shadow-sm gap-2"
                        >
                            <Package className="w-4 h-4" /> New Reorder
                        </Button>

                        {/* Date */}
                        <div className="hidden xl:flex items-center gap-2 text-xs font-semibold text-slate-500 bg-white border border-slate-200/80 px-3 py-2 rounded-lg shadow-sm">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                        </div>

                        {/* Notifications */}
                        <div className="relative" ref={notificationRef}>
                            <p
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="p-2.5 bg-white border border-slate-200/80 rounded-xl text-slate-400 hover:text-slate-600 hover:border-slate-300 hover:shadow-md transition-all relative outline-none group"
                            >
                                <motion.div
                                    animate={supplierRequests.length > 0 ? { rotate: [0, -20, 20, -20, 20, 0] } : {}}
                                    transition={{ repeat: Infinity, repeatDelay: 2.5, duration: 0.8, ease: "easeInOut" }}
                                >
                                    <Bell className="w-5 h-5 group-hover:scale-105 transition-transform" />
                                </motion.div>

                                {supplierRequests.length > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                                        {supplierRequests.length}
                                    </span>
                                )}
                            </p>

                            <AnimatePresence>
                                {showNotifications && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="absolute top-full right-0 mt-3 w-80 md:w-96 bg-white rounded-2xl shadow-xl shadow-slate-200 border border-slate-100 p-4 z-50 origin-top-right ring-1 ring-slate-100/50"
                                    >
                                        <div className="flex items-center justify-between mb-4 px-1">
                                            <h3 className="font-bold text-slate-800">Notifications</h3>
                                            {supplierRequests.length > 0 && <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">{supplierRequests.length} New</span>}
                                        </div>

                                        <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                                            {supplierRequests.length === 0 ? (
                                                <div className="text-center py-8">
                                                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                                        <Bell className="w-5 h-5 text-slate-300" />
                                                    </div>
                                                    <p className="text-sm text-slate-400">No new notifications</p>
                                                </div>
                                            ) : (
                                                supplierRequests.map(req => (
                                                    <div key={req.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-100 transition-colors">
                                                        <div className="flex items-start gap-3 mb-3">
                                                            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600 shrink-0">
                                                                <Truck className="w-4 h-4" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-slate-800">{req.supplier?.name || "Unknown"}</p>
                                                                <p className="text-xs text-slate-500 mt-0.5">Wants to connect with your store</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleAcceptRequest(req.id)}
                                                                className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 border-none shadow-sm text-white"
                                                            >
                                                                Accept
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleRejectRequest(req.id)}
                                                                className="flex-1 h-8 text-xs border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 bg-white"
                                                            >
                                                                Reject
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Divider */}
                        <div className="h-8 w-[1px] bg-slate-200 hidden sm:block mx-1"></div>

                        {/* User Profile & Logout */}
                        <div className="flex items-center gap-3 pl-1">

                            {/* User Info */}
                            <div className="hidden sm:flex flex-col items-end leading-tight">
                                <span className="text-sm font-semibold text-slate-800">
                                    {auth.user?.username}
                                </span>
                                <span className="text-[11px] font-medium text-slate-400 capitalize">
                                    {auth.user?.globalRole?.toLowerCase()}
                                </span>
                            </div>

                            {/* Avatar */}
                            <div className="flex items-center justify-center w-10 h-10 rounded-full 
                  bg-gradient-to-br from-slate-100 to-white text-slate-700 
                  font-semibold shadow-inner border border-slate-200">
                                {auth.user?.username?.charAt(0)?.toUpperCase()}
                            </div>

                            {/* Logout Button */}
                            <p
                                onClick={handleLogout}
                                className="w-10 h-10 flex items-center justify-center rounded-full
             bg-transparent text-slate-500 border border-slate-200 shadow-sm
             hover:bg-red-50 hover:text-red-600 hover:border-red-200
             transition-all"
                                title="Sign out"
                            >
                                <LogOut className="w-5 h-5" /> {/* increased size */}
                            </p>

                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8 space-y-8 relative z-10">

                {/* Welcome Section */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col md:flex-row md:items-end justify-between gap-4"
                >
                    <div>
                        <h2 className="text-3xl font-bold text-slate-800">
                            {getGreeting()}, <span className={`bg-gradient-to-r ${theme.gradient} bg-clip-text text-transparent`}>{auth.user?.username.split(' ')[0]}</span>
                        </h2>
                        <p className="text-slate-500 mt-1">Here's what's happening in your store today.</p>
                    </div>
                    {data?.lists.lowStock.length ? (
                        <div className="animate-pulse bg-amber-50 text-amber-700 px-4 py-2 rounded-lg text-sm font-medium border border-amber-200 flex items-center gap-2">
                            <Package className="w-4 h-4" />
                            {data.lists.lowStock.length} items low on stock
                        </div>
                    ) : null}
                </motion.div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {stats.map((stat, idx) => (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            whileHover={{ y: -4, transition: { duration: 0.2 } }}
                            className={`bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:${theme.shadow} transition-all group`}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 rounded-xl ${stat.bg} ${stat.text} group-hover:scale-110 transition-transform duration-300`}>
                                    <stat.icon className="w-6 h-6" />
                                </div>
                                {stat.change && (
                                    <span
                                        className={`text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1 ${stat.change.includes("Action") ? "bg-red-50 text-red-600" : ""}`}
                                        style={!stat.change.includes("Action") ? { backgroundColor: theme.hex + '20', color: theme.hex } : undefined}
                                    >
                                        {stat.change.includes("Action") ? <X className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                                        {stat.change}
                                    </span>
                                )}
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-slate-800">{stat.value}</h3>
                                <p className="text-sm text-slate-500 font-medium mt-1">{stat.label}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Sales Chart */}
                    <div className="lg:col-span-2">
                        <Card className="h-full border-slate-100 shadow-sm rounded-3xl overflow-hidden bg-white">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <div className="space-y-1">
                                    <CardTitle className="text-xl font-bold text-slate-800">Sales Trend</CardTitle>
                                    <CardDescription className="text-slate-500 font-medium">
                                        Revenue performance over time
                                    </CardDescription>
                                </div>
                                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                                    <SelectTrigger
                                        className="w-[130px] rounded-xl border-2 font-bold shadow-sm focus:ring-0"
                                        style={{ color: theme.hex, borderColor: theme.hex, backgroundColor: theme.hex + '15' }}
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent align="end" className="rounded-xl border-slate-100 shadow-xl">
                                        <SelectItem value="7d" className="rounded-lg">Last 7 days</SelectItem>
                                        <SelectItem value="15d" className="rounded-lg">Last 15 days</SelectItem>
                                        <SelectItem value="30d" className="rounded-lg">Last 30 days</SelectItem>
                                        <SelectItem value="all" className="rounded-lg">All Time</SelectItem>
                                    </SelectContent>
                                </Select>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-3xl font-bold text-slate-800">
                                            ₹{data?.charts.salesByDay
                                                .slice(selectedPeriod === '7d' ? -7 : selectedPeriod === '15d' ? -15 : selectedPeriod === '30d' ? -30 : 0)
                                                .reduce((acc, curr) => acc + curr.revenue, 0)
                                                .toLocaleString()}
                                        </span>
                                        <span className="text-sm font-medium text-slate-500">total revenue</span>
                                    </div>
                                </div>

                                <ChartContainer config={chartConfig} className="w-full h-[300px]">
                                    <ComposedChart
                                        data={data?.charts.salesByDay
                                            .slice(selectedPeriod === '7d' ? -7 : selectedPeriod === '15d' ? -15 : selectedPeriod === '30d' ? -30 : 0)
                                            .map(d => ({
                                                date: new Date(d.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
                                                revenue: d.revenue
                                            })) || []}
                                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                                    >
                                        <defs>
                                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={theme.hex} stopOpacity={0.2} />
                                                <stop offset="95%" stopColor={theme.hex} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="date"
                                            tickLine={false}
                                            axisLine={false}
                                            tickMargin={12}
                                            tick={{ fill: '#94a3b8', fontSize: 12 }}
                                        />
                                        <YAxis
                                            tickLine={false}
                                            axisLine={false}
                                            tickMargin={12}
                                            tick={{ fill: '#94a3b8', fontSize: 12 }}
                                            tickFormatter={(value) => `₹${value}`}
                                        />
                                        <ChartTooltip
                                            cursor={{ stroke: '#e2e8f0' }}
                                            content={
                                                <ChartTooltipContent
                                                    className="w-40 bg-white/95 backdrop-blur-md border-slate-100 shadow-xl rounded-xl"
                                                />
                                            }
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="revenue"
                                            stroke={theme.hex}
                                            strokeWidth={2}
                                            fillOpacity={1}
                                            fill="url(#colorRevenue)"
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="revenue"
                                            stroke={theme.hex}
                                            strokeWidth={2}
                                            dot={false}
                                            activeDot={{
                                                r: 6,
                                                fill: theme.hex,
                                                stroke: "#fff",
                                                strokeWidth: 3
                                            }}
                                        />
                                    </ComposedChart>
                                </ChartContainer>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Recent Activity */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm flex flex-col relative"
                    >
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <Activity className={`w-5 h-5 ${theme.text}`} />
                            Recent Activity
                        </h3>
                        <div className="relative pl-2 space-y-6 flex-1 overflow-visible">
                            {/* Timeline Connector */}
                            <div className="absolute left-[27px] top-4 bottom-4 w-[2px] bg-slate-100"></div>

                            {data?.lists.activity && data.lists.activity.slice(0, isActivityExpanded ? 10 : 3).map((log, i) => {
                                const config = getActivityConfig(log.action);
                                return (
                                    <motion.div
                                        key={log.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.1 }}
                                        className="relative flex items-center gap-4 group z-10"
                                    >
                                        <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center ${config.bg} ${config.color} border ${config.border} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                                            <config.icon className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 p-3 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all duration-200">
                                            <p className="text-sm font-bold text-slate-700 leading-tight group-hover:text-emerald-800 transition-colors">
                                                {log.action.replace(/_/g, " ")}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
                                                    {log.action.split('_')[0]}
                                                </span>
                                                <span className="text-xs text-slate-400 font-medium">
                                                    {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                                                </span>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}

                            {(!data?.lists.activity || data.lists.activity.length === 0) && (
                                <div className="text-center py-12 flex flex-col items-center">
                                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                                        <FileText className="w-5 h-5 text-slate-300" />
                                    </div>
                                    <p className="text-sm text-slate-400">No activity recorded yet</p>
                                </div>
                            )}
                        </div>

                        {data?.lists.activity && data.lists.activity.length > 3 && (
                            <>
                                {!isActivityExpanded && (
                                    <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white/95 via-white/60 to-transparent backdrop-blur-[2px] flex items-end justify-center pb-4 rounded-b-3xl pointer-events-none">
                                        <p
                                            onClick={() => setIsActivityExpanded(true)}
                                            className="pointer-events-auto p-2 bg-white/80 backdrop-blur-md rounded-full shadow-lg border border-slate-100 text-slate-400 hover:text-emerald-600 hover:scale-110 transition-all cursor-pointer"
                                        >
                                            <ChevronDown className="w-5 h-5" />
                                        </p>
                                    </div>
                                )}
                                {isActivityExpanded && (
                                    <div className="mt-6 flex justify-center">
                                        <p
                                            onClick={() => setIsActivityExpanded(false)}
                                            className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all cursor-pointer"
                                        >
                                            <ChevronUp className="w-5 h-5" />
                                        </p>
                                    </div>
                                )}
                            </>
                        )}
                    </motion.div>

                    {/* Connected Suppliers */}
                    <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm flex flex-col h-full">
                         <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Users className={`w-5 h-5 ${theme.text}`} />
                                Connected Suppliers
                            </h3>
                            <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => setShowDirectory(true)}
                                className={`text-xs ${theme.text} ${theme.border} hover:${theme.light} bg-white`}
                            >
                                <Search className="w-3 h-3 mr-1" />
                                Find Suppliers
                            </Button>
                        </div>
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                             {data?.lists.suppliers && data.lists.suppliers.length > 0 ? (
                                data.lists.suppliers.map(supplier => (
                                    <div key={supplier.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <div>
                                            <p className="font-bold text-slate-800">{supplier.name}</p>
                                            <p className="text-xs text-slate-500">{supplier.email || supplier.user?.email || "No email"}</p>
                                        </div>
                                        <Button 
                                            size="sm" 
                                            variant="outline" 
                                            className="h-8 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                                            onClick={() => handleDisconnectSupplier(supplier.id)}
                                        >
                                            Disconnect
                                        </Button>
                                    </div>
                                ))
                             ) : (
                                <p className="text-sm text-slate-400 text-center py-8">No suppliers connected yet.</p>
                             )}
                        </div>
                    </div>

                    {/* Active Reorders */}
                    <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm flex flex-col h-full mt-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Package className={`w-5 h-5 ${theme.text}`} />
                                Sent Reorders
                            </h3>
                        </div>
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                             {myRequests.length > 0 ? (
                                myRequests
                                .filter(r => r.payload?.type === 'REORDER')
                                .map(req => (
                                    <div key={req.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-slate-800">Order #{req.id.slice(0,6)}</p>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                    req.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-700' :
                                                    req.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                                    'bg-amber-100 text-amber-700'
                                                }`}>
                                                    {req.status}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1">
                                                {new Date(req.createdAt).toLocaleDateString()} • {req.payload?.items?.length || 0} Items
                                            </p>
                                        </div>
                                        <div className="text-xs text-slate-400">
                                            {/* Could add 'Cancel' button here if PENDING */}
                                            To: {data?.lists?.suppliers?.find(s => s.id === req.supplierId)?.name || "Supplier"}
                                        </div>
                                    </div>
                                ))
                             ) : (
                                <p className="text-sm text-slate-400 text-center py-8">No active reorders found.</p>
                             )}
                        </div>
                    </div>
                </div>

                {/* Suppliers Directory Modal */}
                <AnimatePresence>
                    {showDirectory && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                            <motion.div 
                                initial={{ opacity: 0 }} 
                                animate={{ opacity: 1 }} 
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                                onClick={() => setShowDirectory(false)}
                            />
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="bg-white rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl relative z-10 overflow-hidden"
                            >
                                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                    <h3 className="text-xl font-bold text-slate-800">Supplier Directory</h3>
                                    <button onClick={() => setShowDirectory(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                
                                <div className="p-6 overflow-y-auto custom-scrollbar space-y-4">
                                    {directorySuppliers.length === 0 ? (
                                        <div className="text-center py-12">
                                            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <Search className="w-5 h-5 text-slate-300" />
                                            </div>
                                            <p className="text-slate-500">No suppliers found in directory.</p>
                                        </div>
                                    ) : (
                                        directorySuppliers.map(supplier => (
                                            <div key={supplier.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-md transition-all flex items-center justify-between group">
                                                <div>
                                                     <h4 className="font-bold text-slate-800 text-base">{supplier.name}</h4>
                                                     <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                                                         <span>{supplier.contactName || "No Contact"}</span>
                                                         {supplier.phone && <span>• {supplier.phone}</span>}
                                                         {supplier.email && <span>• {supplier.email}</span>}
                                                     </div>
                                                </div>
                                                <div>
                                                    {supplier.connectionStatus === "CONNECTED" ? (
                                                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold flex items-center gap-1 border border-emerald-200">
                                                            <Check className="w-3 h-3" /> Connected
                                                        </span>
                                                    ) : supplier.connectionStatus === "PENDING_OUTBOUND" ? (
                                                        <div className="flex flex-col items-end gap-1">
                                                            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold flex items-center gap-1 border border-slate-200">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></div>
                                                                Request Sent
                                                            </span>
                                                            {supplier.requestDate && <span className="text-[10px] text-slate-400 font-medium">
                                                                {new Date(supplier.requestDate).toLocaleDateString()}
                                                            </span>}
                                                        </div>
                                                    ) : supplier.connectionStatus === "PENDING_INBOUND" ? (
                                                        <div className="flex flex-col items-end gap-2">
                                                            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 flex items-center gap-1">
                                                                <Activity className="w-3 h-3" /> Action Required
                                                            </span>
                                                            <div className="flex gap-1">
                                                                <Button 
                                                                    size="sm"
                                                                    className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                                                    onClick={() => handleDirectoryAccept(supplier.requestId)}
                                                                >
                                                                    Accept
                                                                </Button>
                                                                <Button 
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-7 text-xs border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                                                                    onClick={() => handleDirectoryReject(supplier.requestId)}
                                                                >
                                                                    Reject
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <Button 
                                                            size="sm"
                                                            onClick={() => handleConnectRequest(supplier.id)}
                                                            className={`bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 rounded-full px-5`}
                                                        >
                                                            Connect
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>


            </main>
            <FeedbackToast
                visible={showFeedback}
                onClose={() => setShowFeedback(false)}
                message="Request processed successfully"
                onFeedback={(type) => console.log("Feedback:", type)}
            />

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
                                        Are you sure you want to end your session? You'll need to sign in again to access your store.
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
                                        onClick={logout}
                                    >
                                        Yes, Sign Out
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Reorder Modal */}
            <AnimatePresence>
                {reorderModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
                        >
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">New Reorder Request</h2>
                                    <p className="text-sm text-slate-500">Select items to restock and choose a supplier.</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={handleSmartFill}
                                        disabled={isAiLoading}
                                        className="hidden md:flex gap-2 text-white bg-gradient-to-r from-indigo-500 to-purple-600 border-none hover:opacity-90 shadow-md shadow-indigo-200 transition-all duration-300 relative overflow-hidden group"
                                    >
                                        {isAiLoading ? (
                                             <Sparkles className="w-4 h-4 animate-spin" /> 
                                        ) : (
                                            <Sparkles className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                        )}
                                        {isAiLoading ? "Generate AI Draft..." : "AI Auto-Fill"}
                                        <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent z-10" />
                                    </Button>
                                    <button onClick={() => setReorderModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                        <X className="w-6 h-6 text-slate-400" />
                                    </button>
                                </div>
                            </div>

                            {isAiLoading ? (
                                <div className="flex-1 overflow-hidden flex flex-col md:flex-row animate-pulse">
                                    <div className="flex-1 p-6 border-r border-slate-100">
                                        <div className="flex items-center gap-3 mb-6">
                                            <Skeleton className="w-8 h-8 rounded-full" />
                                            <Skeleton className="h-10 w-full rounded-xl" />
                                        </div>
                                        <div className="space-y-4">
                                            {[1, 2, 3, 4].map((i) => (
                                                <div key={i} className="flex justify-between items-center p-4 border border-slate-50 rounded-xl">
                                                    <div className="space-y-2">
                                                        <Skeleton className="h-4 w-32" />
                                                        <Skeleton className="h-3 w-20" />
                                                    </div>
                                                    <Skeleton className="h-8 w-16 rounded-md" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="w-full md:w-80 p-6 bg-slate-50 flex flex-col gap-4">
                                        <Skeleton className="h-6 w-32 mb-2" />
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Skeleton className="h-4 w-20" />
                                                <Skeleton className="h-10 w-full rounded-md" />
                                            </div>
                                            <div className="space-y-2">
                                                <Skeleton className="h-32 w-full rounded-xl" />
                                            </div>
                                            <Skeleton className="h-12 w-full rounded-xl mt-4" />
                                        </div>
                                    </div>
                                </div>
                            ) : (

                            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                                {/* Left: Inventory Selection */}
                                <div className="flex-1 p-6 overflow-y-auto border-r border-slate-100">
                                    <div className="mb-4 relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search medicines..."
                                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                            // Implement filtering logic if desired, for now relying on scroll list
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        {inventoryList.map((med) => (
                                            <div key={med.id} className="p-4 border border-slate-100 rounded-xl hover:border-emerald-200 hover:shadow-sm transition-all flex justify-between items-center group">
                                                <div>
                                                    <p className="font-bold text-slate-800">{med.brandName} <span className="text-slate-400 font-normal text-xs ml-1">{med.strength}</span></p>
                                                    <p className="text-xs text-slate-500">{med.genericName}</p>
                                                    <div className="flex gap-2 mt-1">
                                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Curr: {med.totalQty}</span>
                                                        {med.expiringSoon && <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded">Expiring Soon</span>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {cart.has(med.id) ? (
                                                        <div className="flex items-center bg-slate-100 rounded-lg p-1">
                                                            <button 
                                                                onClick={() => handleAddToCart(med.id, (cart.get(med.id) || 0) - 1)}
                                                                className="w-7 h-7 flex items-center justify-center hover:bg-white rounded-md transition-colors"
                                                            >-</button>
                                                            <span className="w-8 text-center font-bold text-sm">{cart.get(med.id)}</span>
                                                            <button 
                                                                onClick={() => handleAddToCart(med.id, (cart.get(med.id) || 0) + 1)}
                                                                className="w-7 h-7 flex items-center justify-center hover:bg-white rounded-md transition-colors"
                                                            >+</button>
                                                        </div>
                                                    ) : (
                                                        <Button size="sm" variant="outline" onClick={() => handleAddToCart(med.id, 1)} className="hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200">
                                                            Add
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Right: Cart & Details */}
                                <div className="w-full md:w-80 bg-slate-50 p-6 flex flex-col overflow-y-auto">
                                    <h3 className="font-bold text-slate-700 mb-4">Order Summary</h3>
                                    
                                    <div className="flex-1 space-y-4">
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="block text-sm font-medium text-slate-600">Select Supplier</label>
                                                <span className="text-xs text-slate-400">
                                                    {data?.lists?.suppliers?.length || 0} available
                                                </span>
                                            </div>
                                            <Select value={reorderSupplierId} onValueChange={setReorderSupplierId} disabled={!data?.lists?.suppliers?.length}>
                                                <SelectTrigger className="w-full bg-white border-slate-200">
                                                    <SelectValue placeholder="Choose Supplier" />
                                                </SelectTrigger>
                                                <SelectContent className="z-[9999]" position="popper">
                                                    {data?.lists?.suppliers?.map((s) => (
                                                        <SelectItem key={s.id} value={s.id}>
                                                            {s.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {!data?.lists?.suppliers?.length && (   
                                                <p className="text-xs text-red-500 mt-1">
                                                    No suppliers linked. Please go to Directory to add one.
                                                </p>
                                            )}
                                        </div>

                                        <div className="bg-white rounded-xl border border-slate-200 p-4 min-h-[100px]">
                                            {cart.size === 0 ? (
                                                <div className="text-center text-slate-400 text-sm py-4">
                                                    Cart is empty
                                                </div>
                                            ) : (
                                                <ul className="space-y-2">
                                                    {Array.from(cart.entries()).map(([id, qty]) => {
                                                        const m = inventoryList.find(x => x.id === id);
                                                        return (
                                                            <li key={id} className="text-sm flex justify-between">
                                                                <span className="truncate max-w-[140px] text-slate-600">{m?.brandName}</span>
                                                                <span className="font-bold text-slate-800">x{qty}</span>
                                                            </li>
                                                        )
                                                    })}
                                                </ul>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-2">Note (Optional)</label>
                                            <textarea 
                                                className="w-full p-3 text-sm border border-slate-200 rounded-xl resize-none focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                                                rows={3}
                                                placeholder="Urgent delivery needed..."
                                                value={reorderNote}
                                                onChange={e => setReorderNote(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <Button 
                                        className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/30"
                                        disabled={cart.size === 0 || !reorderSupplierId}
                                        onClick={submitReorder}
                                    >
                                        Send Request ({cart.size} Items)
                                    </Button>
                                </div>
                            </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};



export default StoreOwnerDashboard;
