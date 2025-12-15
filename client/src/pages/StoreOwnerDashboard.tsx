import React from "react";
import { useRecoilValue } from "recoil";
import { authState } from "../state/auth";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Settings, LogOut, Users, Package, Calendar, Search, X, Sparkles, Lock, Truck, Zap, Check, FileText, ChevronDown, ChevronUp, Activity, ShoppingCart, Link, Store, CheckCircle, Send, History, ClipboardList, Download, Mail, Phone, Trash2, ArrowRight } from "lucide-react";
import { Dock, DockIcon, DockItem, DockLabel } from "../components/ui/dock";

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
    const [receipts, setReceipts] = React.useState<any[]>([]);

    const [showNotifications, setShowNotifications] = React.useState(false);
    const [showFeedback, setShowFeedback] = React.useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
    const [isActivityExpanded, setIsActivityExpanded] = React.useState(false);
    const [selectedPeriod, setSelectedPeriod] = React.useState('7d');
    const notificationRef = React.useRef<HTMLDivElement>(null);
    const [selectedTheme, setSelectedTheme] = React.useState("green");
    const [selectedAvatar, setSelectedAvatar] = React.useState("fruit-strawberry");

    // Reorder State

    const [inventoryList, setInventoryList] = React.useState<any[]>([]);
    const [cart, setCart] = React.useState<Map<string, number>>(new Map()); // medicineId -> qty
    const [reorderSupplierId, setReorderSupplierId] = React.useState<string>("");
    const [reorderNote, setReorderNote] = React.useState("");
    const [isAiLoading, setIsAiLoading] = React.useState(false);
    const [reorderSearchQuery, setReorderSearchQuery] = React.useState("");

    const [isReorderLoading, setIsReorderLoading] = React.useState(false);
    const [isHistoryLoading, setIsHistoryLoading] = React.useState(false);

    // POS Payment & Receipt Preview State
    const [posPaymentMethod, setPosPaymentMethod] = React.useState<string>("CASH");
    const [showReceiptPreview, setShowReceiptPreview] = React.useState(false);
    const [currentReceiptUrl, setCurrentReceiptUrl] = React.useState<string | null>(null);
    const [currentSaleId, setCurrentSaleId] = React.useState<string | null>(null);
    const [receiptEmail, setReceiptEmail] = React.useState("");
    const [isSendingEmail, setIsSendingEmail] = React.useState(false);
    const [showReorderConfirm, setShowReorderConfirm] = React.useState(false);
    const [showDisconnectConfirm, setShowDisconnectConfirm] = React.useState(false);
    const [disconnectSupplierId, setDisconnectSupplierId] = React.useState<string | null>(null);
    const [selectedReorder, setSelectedReorder] = React.useState<SupplierRequest | null>(null);
    const [showReorderDetails, setShowReorderDetails] = React.useState(false);

    const [activeTab, setActiveTab] = React.useState<"overview" | "reorder" | "sale" | "history" | "suppliers" | "sent_reorders">("overview");

    const NAV_ITEMS = [
        { label: "Overview", icon: Store, tab: "overview", color: "text-blue-500" },
        { label: "New Reorder", icon: Zap, tab: "reorder", color: "text-amber-500" },
        { label: "Sent Reorders", icon: Package, tab: "sent_reorders", color: "text-indigo-500" },
        { label: "New Sale", icon: ShoppingCart, tab: "sale", color: "text-emerald-500" },
        { label: "Sales History", icon: History, tab: "history", color: "text-slate-500" },
        { label: "Suppliers", icon: Users, tab: "suppliers", color: "text-purple-500" },
    ];


    const handleOpenReorder = async () => {
        setIsReorderLoading(true);
        try {
            const res = await dashboardApi.getInventory();
            if (res.data.success) {
                setInventoryList(res.data.data.inventory);
            }
        } catch (err) {
            console.error("Failed to fetch inventory for reorder", err);
        } finally {
            setIsReorderLoading(false);
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

    const handleReorderClick = () => {
        if (!reorderSupplierId) {
            alert("Please select a supplier.");
            return;
        }
        if (cart.size === 0) {
            alert("Please add items to reorder.");
            return;
        }
        setShowReorderConfirm(true);
    };

    const executeReorder = async () => {
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
                setActiveTab('overview');
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

                // If inventoryList happens to be empty (user went straight to AI fill without viewing reorder tab), fetch it
                if (inventoryList.length === 0) {
                    handleOpenReorder();
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

    // --- POS / Checkout State ---

    const [posQuery, setPosQuery] = React.useState("");
    const [isPosLoading, setIsPosLoading] = React.useState(false);
    const [posResults, setPosResults] = React.useState<any[]>([]);
    const [posCart, setPosCart] = React.useState<Map<string, number>>(new Map()); // medicineId -> qty
    const [isCheckoutLoading, setIsCheckoutLoading] = React.useState(false);
    const [showPOSConfirm, setShowPOSConfirm] = React.useState(false);

    // Debounced search for POS

    React.useEffect(() => {
        if (activeTab !== 'sale') return;

        const timer = setTimeout(() => {
            // Fetch even if query is empty (to show recent items)
            searchPOSMedicines(posQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [posQuery, activeTab]);

    const searchPOSMedicines = async (q: string) => {
        setIsPosLoading(true);
        try {
            const res = await dashboardApi.searchMedicines(q);
            if (res.data.success) {
                setPosResults(res.data.data.medicines);
            }
        } catch (err) {
            console.error("POS Search failed", err);
        } finally {
            setIsPosLoading(false);
        }
    };

    const handlePOSAddToCart = (medicine: any, qty: number) => {
        // Validation: Check stock
        const currentStock = medicine.inventory?.reduce((acc: number, b: any) => acc + b.qtyAvailable, 0) || 0;

        if (qty > currentStock) {
            alert(`Cannot add more than available stock (${currentStock})`);
            return;
        }

        setPosCart(prev => {
            const newCart = new Map(prev);
            if (qty <= 0) newCart.delete(medicine.id);
            else newCart.set(medicine.id, qty);
            return newCart;
        });
    };

    const handleSendReceipt = async () => {
        if (!currentSaleId) {
            alert("Error: Sale ID not found. Cannot send receipt.");
            return;
        }
        if (!receiptEmail) {
            alert("Please enter a valid email.");
            return;
        }
        setIsSendingEmail(true);
        try {
            await dashboardApi.sendReceiptEmail(currentSaleId, receiptEmail);
            alert("Receipt sent successfully!");
            setReceiptEmail("");
        } catch (err: any) {
            console.error(err);
            alert("Failed to send email: " + (err.response?.data?.message || err.message));
        } finally {
            setIsSendingEmail(false);
        }
    };

    const handlePOSCheckoutClick = () => {
        if (posCart.size === 0) return;
        setShowPOSConfirm(true);
    };

    const executeCheckout = async () => {
        if (posCart.size === 0) return;

        setIsCheckoutLoading(true);
        try {
            const items = Array.from(posCart.entries()).map(([medicineId, qty]) => ({ medicineId, qty }));

            // Pass paymentMethod from state
            const res = await dashboardApi.checkoutSale(items, posPaymentMethod);

            // "res.data" is the blob because responseType: 'blob'
            const blob = new Blob([res.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);

            // Extract Sale ID from headers
            const saleId = res.headers['x-sale-id'];

            setCurrentReceiptUrl(url);
            if (saleId) setCurrentSaleId(saleId);

            setShowReceiptPreview(true);

            // Reset cart
            setPosCart(new Map());
            setPosQuery("");
            setPosPaymentMethod("CASH"); // Reset to default

            // Refresh dashboard data/receipts silently?
            try {
                const r = await dashboardApi.getReceipts();
                setReceipts(r.data.data.receipts);
            } catch (e) {
                console.error("Failed to refresh receipts", e);
            }

        } catch (err: any) {
            console.error(err);
            alert("Checkout failed: " + (err.response?.data?.message || err.message));
        } finally {
            setIsCheckoutLoading(false);
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

    // Effect to handle tab-specific data fetching
    React.useEffect(() => {
        if (activeTab === 'reorder') {
            handleOpenReorder();
        } else if (activeTab === 'sale') {
            searchPOSMedicines("");
        } else if (activeTab === 'history') {
            handleViewReceipts();
        }
    }, [activeTab]);


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

    const handleDisconnectSupplier = (supplierId: string) => {
        setDisconnectSupplierId(supplierId);
        setShowDisconnectConfirm(true);
    };

    const executeDisconnectSupplier = async () => {
        if (!disconnectSupplierId) return;
        try {
            await dashboardApi.disconnectSupplier(disconnectSupplierId);
            // Optimistically update lists.suppliers
            setData(prev => prev ? {
                ...prev,
                lists: {
                    ...prev.lists,
                    suppliers: prev.lists.suppliers.filter(s => s.id !== disconnectSupplierId)
                }
            } : null);
            setShowFeedback(true);
        } catch (err) {
            console.error("Failed to disconnect", err);
            alert("Failed to disconnect supplier");
        } finally {
            setShowDisconnectConfirm(false);
            setDisconnectSupplierId(null);
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





    // --- Receipts / History ---
    const handleViewReceipts = async () => {
        setIsHistoryLoading(true);
        try {
            const res = await dashboardApi.getReceipts();
            if (res.data.success) {
                setReceipts(res.data.data.receipts);
            }
        } catch (err) {
            console.error("Failed to fetch receipts", err);
        } finally {
            setIsHistoryLoading(false);
        }
    };

    const viewReceiptPDF = async (id: string) => {
        try {
            const res = await dashboardApi.getReceiptPDF(id);
            const file = new Blob([res.data as any], { type: 'application/pdf' });
            const fileURL = URL.createObjectURL(file);
            setCurrentReceiptUrl(fileURL);
            setShowReceiptPreview(true);
        } catch (err) {
            console.error("Failed to load PDF", err);
            alert("Failed to load PDF");
        }
    };

    const downloadReceiptPDF = async (id: string, receiptNo?: string) => {
        try {
            const res = await dashboardApi.getReceiptPDF(id);
            const file = new Blob([res.data as any], { type: 'application/pdf' });
            const fileURL = URL.createObjectURL(file);
            const link = document.createElement('a');
            link.href = fileURL;
            link.download = `Receipt-${receiptNo || id}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error("Failed to download PDF", err);
            alert("Failed to download PDF");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50/50">
                {/* Header Skeleton */}
                <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200/60 h-20">
                    <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Skeleton className="w-12 h-12 rounded-2xl" />
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-3 w-20" />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Skeleton className="w-10 h-10 rounded-full" />
                            <Skeleton className="w-10 h-10 rounded-full" />
                        </div>
                    </div>
                </header>

                <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
                    {/* Welcome Skeleton */}
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-64" />
                        <Skeleton className="h-4 w-48" />
                    </div>

                    {/* Stats Grid Skeleton */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                                <div className="flex justify-between mb-4">
                                    <Skeleton className="w-12 h-12 rounded-xl" />
                                    <Skeleton className="w-16 h-6 rounded-full" />
                                </div>
                                <div className="space-y-2">
                                    <Skeleton className="h-8 w-24" />
                                    <Skeleton className="h-4 w-32" />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Chart Skeleton */}
                        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-3xl p-6 h-[400px]">
                            <div className="flex justify-between mb-8">
                                <div className="space-y-2">
                                    <Skeleton className="h-6 w-32" />
                                    <Skeleton className="h-4 w-48" />
                                </div>
                                <Skeleton className="h-10 w-32 rounded-xl" />
                            </div>
                            <Skeleton className="w-full h-[250px] rounded-xl" />
                        </div>

                        {/* Recent Activity Skeleton */}
                        <div className="bg-white border border-slate-100 rounded-3xl p-6 h-[400px]">
                            <Skeleton className="h-6 w-32 mb-6" />
                            <div className="space-y-6">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="flex gap-4">
                                        <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
                                        <div className="w-full space-y-2">
                                            <Skeleton className="h-4 w-full" />
                                            <Skeleton className="h-3 w-20" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </main>
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



                    {/* Action buttons moved to Dock */}
                    <div className="flex items-center gap-2">

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
                {activeTab === 'overview' && (
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
                )}

                {/* --- OVERVIEW TAB --- */}
                {activeTab === 'overview' && (
                    <>
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
                        </div>
                    </>
                )}

                {/* --- CONNECTED SUPPLIERS TAB --- */}
                {activeTab === 'suppliers' && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="h-full flex flex-col"
                    >
                        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col h-full">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        <Users className={`w-6 h-6 ${theme.text}`} />
                                        My Network
                                    </h2>
                                    <p className="text-sm text-slate-500">Manage your connected suppliers.</p>
                                </div>
                                <Button
                                    onClick={() => setShowDirectory(true)}
                                    className={`${theme.primary} text-white hover:opacity-90 shadow-lg ${theme.shadow} border-none rounded-xl gap-2 font-semibold`}
                                >
                                    <Search className="w-4 h-4" />
                                    Find New Suppliers
                                </Button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 bg-slate-50 custom-scrollbar">
                                {data?.lists.suppliers && data.lists.suppliers.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {data.lists.suppliers.map((supplier, index) => (
                                            <motion.div
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.05 }}
                                                key={supplier.id}
                                                className="bg-white rounded-3xl p-1 border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
                                            >
                                                <div className="bg-slate-50/50 rounded-[20px] p-5 h-full flex flex-col relative overflow-hidden">
                                                    {/* Decorative Background */}
                                                    <div className={`absolute -right-6 -top-6 w-32 h-32 rounded-full ${theme.light} opacity-0 group-hover:opacity-20 transition-opacity blur-2xl`} />

                                                    {/* Header */}
                                                    <div className="flex items-start justify-between mb-4 relative z-10">
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-14 h-14 rounded-2xl ${theme.gradient} p-[2px] shadow-lg`}>
                                                                <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center text-xl font-bold text-slate-700">
                                                                    {supplier.name.charAt(0).toUpperCase()}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <h3 className="font-bold text-slate-800 text-lg leading-tight">{supplier.name}</h3>
                                                                <div className="flex items-center gap-1.5 mt-1">
                                                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                                    <span className="text-xs font-medium text-emerald-600">Active Supplier</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <i
                                                            className="h-8 w-8 flex items-center justify-center cursor-pointer text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDisconnectSupplier(supplier.id);
                                                            }}
                                                            title="Disconnect Supplier"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </i>
                                                    </div>

                                                    {/* Contact Info */}
                                                    <div className="space-y-3 mb-6 relative z-10 bg-white/60 p-3 rounded-xl border border-slate-100/50 backdrop-blur-sm">
                                                        <div className="flex items-center gap-3 text-sm text-slate-600">
                                                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                                                                <Mail className="w-4 h-4" />
                                                            </div>
                                                            <span className="truncate flex-1 font-medium">{supplier.email || supplier.user?.email || "No email"}</span>
                                                        </div>
                                                        {(supplier.phone || supplier.contactName) && (
                                                            <div className="flex items-center gap-3 text-sm text-slate-600">
                                                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                                                                    <Phone className="w-4 h-4" />
                                                                </div>
                                                                <span className="truncate flex-1 font-medium">
                                                                    {supplier.contactName && <span className="text-slate-900">{supplier.contactName}</span>}
                                                                    {supplier.contactName && supplier.phone && <span className="mx-1 text-slate-300">|</span>}
                                                                    {supplier.phone}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="mt-auto pt-4 relative z-10">
                                                        <i
                                                            className={`w-full h-11 rounded-xl ${theme.primary} hover:opacity-90 text-white shadow-lg ${theme.shadow} border-none group/btn flex items-center justify-center gap-2 font-semibold`}
                                                            onClick={() => {
                                                                setReorderSupplierId(supplier.id);
                                                                setActiveTab('reorder');
                                                            }}
                                                        >
                                                            <Zap className="w-4 h-4 fill-white" />
                                                            <span>Quick Reorder</span>
                                                            <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform opacity-60" />
                                                        </i>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-6">
                                        <div className="w-24 h-24 rounded-full bg-white shadow-sm flex items-center justify-center">
                                            <Users className={`w-10 h-10 ${theme.text} opacity-50`} />
                                        </div>
                                        <div className="text-center space-y-2">
                                            <h3 className="text-lg font-bold text-slate-700">No Suppliers Connected</h3>
                                            <p className="max-w-xs mx-auto text-sm">Start building your network by connecting with trusted medicine suppliers.</p>
                                        </div>
                                        <Button
                                            onClick={() => setShowDirectory(true)}
                                            className={`${theme.light} ${theme.text} hover:opacity-80 border-none font-bold`}
                                        >
                                            Browse Directory
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* --- SENT REORDERS TAB --- */}
                {/* --- SENT REORDERS TAB --- */}
                {activeTab === 'sent_reorders' && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="h-full flex flex-col"
                    >
                        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col h-full">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        <Package className={`w-6 h-6 ${theme.text}`} />
                                        Sent Reorders
                                    </h2>
                                    <p className="text-sm text-slate-500">Track the status of your stock replenishment requests.</p>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 bg-slate-50 custom-scrollbar">
                                {myRequests.length > 0 ? (
                                    <div className="grid grid-cols-1 gap-4">
                                        {myRequests
                                            .filter(r => r.payload?.type === 'REORDER')
                                            .map(req => {
                                                const supplierName = data?.lists?.suppliers?.find(s => s.id === req.supplierId)?.name || "Unknown Supplier";
                                                const statusConfig = req.status === 'ACCEPTED' ? { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle } :
                                                    req.status === 'REJECTED' ? { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', icon: X } :
                                                        { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', icon: Activity };
                                                const StatusIcon = statusConfig.icon;

                                                return (
                                                    <div key={req.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-center justify-between gap-6 group">
                                                        <div className="flex items-center gap-5 flex-1">
                                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${statusConfig.bg} ${statusConfig.text}`}>
                                                                <StatusIcon className="w-7 h-7" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-3 mb-1.5">
                                                                    <h4 className="font-bold text-slate-800 text-lg truncate">Order #{req.id.slice(0, 8).toUpperCase()}</h4>
                                                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1.5 shrink-0 ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}>
                                                                        {req.status === 'PENDING' && <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse opacity-60" />}
                                                                        {req.status}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-4 text-sm text-slate-500 truncate">
                                                                    <span className="flex items-center gap-1.5 truncate">
                                                                        <Store className="w-3.5 h-3.5 text-slate-400" />
                                                                        To: <span className="font-medium text-slate-700 truncate">{supplierName}</span>
                                                                    </span>
                                                                    <span className="hidden md:flex items-center gap-1.5 border-l border-slate-200 pl-4 shrink-0">
                                                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                                        {new Date(req.createdAt).toLocaleDateString()}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-slate-100 pt-4 md:pt-0">
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Items</span>
                                                                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                                                    <ClipboardList className="w-4 h-4 text-slate-500" />
                                                                    <span className="font-bold text-slate-800">{req.payload?.items?.length || 0}</span>
                                                                </div>
                                                            </div>

                                                            <Button
                                                                size="sm"
                                                                onClick={() => {
                                                                    setSelectedReorder(req);
                                                                    setShowReorderDetails(true);
                                                                }}
                                                                className={`${theme.primary} text-white hover:opacity-90 shadow-md ${theme.shadow} border-none rounded-xl px-5 h-10 font-semibold gap-2 transition-all`}
                                                            >
                                                                Details <ChevronDown className="w-4 h-4 opacity-60" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-6">
                                        <div className="w-24 h-24 rounded-full bg-white shadow-sm flex items-center justify-center">
                                            <Package className={`w-10 h-10 ${theme.text} opacity-50`} />
                                        </div>
                                        <div className="text-center space-y-2">
                                            <h3 className="text-lg font-bold text-slate-700">No Reorders Given</h3>
                                            <p className="max-w-xs mx-auto text-sm">Your sent reorder requests will appear here once you place orders with suppliers.</p>
                                        </div>
                                        <Button
                                            onClick={() => setActiveTab('reorder')}
                                            className={`${theme.primary} text-white hover:opacity-90 shadow-lg ${theme.shadow} border-none font-bold rounded-xl`}
                                        >
                                            Create New Reorder
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* --- REORDER TAB --- */}
                {activeTab === 'reorder' && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-3xl shadow-2xl w-full flex flex-col overflow-hidden"
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
                                    className={`hidden md:flex gap-2 text-white bg-gradient-to-r ${theme.gradient} border-none hover:opacity-90 shadow-md ${theme.shadow} transition-all duration-300 relative overflow-hidden group`}
                                >
                                    {isAiLoading ? (
                                        <Sparkles className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Sparkles className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                    )}
                                    {isAiLoading ? "Generate AI Draft..." : "AI Auto-Fill"}
                                    <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent z-10" />
                                </Button>
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

                            <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-slate-50/50">
                                {/* Left: Inventory Selection (Styled as Table) */}
                                <div className="flex-1 p-6 overflow-y-auto border-r border-slate-100 bg-white">
                                    <div className="mb-6 relative max-w-md">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search medicines..."
                                            value={reorderSearchQuery}
                                            onChange={(e) => setReorderSearchQuery(e.target.value)}
                                            className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/5 shadow-sm transition-all"
                                        />
                                        {reorderSearchQuery && (
                                            <p
                                                onClick={() => setReorderSearchQuery("")}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                                            >
                                                <X className="w-3 h-3" />
                                            </p>
                                        )}
                                    </div>

                                    <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col max-h-[60vh]">
                                        <div className="overflow-y-auto custom-scrollbar">
                                            <table className="w-full text-left text-sm relative">
                                                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                                                    <tr>
                                                        <th className="px-6 py-4 font-semibold text-slate-700">Medicine Details</th>
                                                        <th className="px-6 py-4 font-semibold text-slate-700">Stock Status</th>
                                                        <th className="px-6 py-4 font-semibold text-slate-700 text-right">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 bg-white">
                                                    {isReorderLoading ? (
                                                        [...Array(5)].map((_, i) => (
                                                            <tr key={i}>
                                                                <td className="px-6 py-4">
                                                                    <div className="space-y-2">
                                                                        <Skeleton className="h-4 w-32" />
                                                                        <Skeleton className="h-3 w-20" />
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <Skeleton className="h-6 w-20 rounded-lg" />
                                                                </td>
                                                                <td className="px-6 py-4 text-right">
                                                                    <div className="flex justify-end">
                                                                        <Skeleton className="h-8 w-24 rounded-lg" />
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    ) : (
                                                        <>
                                                            {inventoryList.filter(med =>
                                                                med.brandName.toLowerCase().includes(reorderSearchQuery.toLowerCase()) ||
                                                                med.genericName.toLowerCase().includes(reorderSearchQuery.toLowerCase())
                                                            ).map((med) => (
                                                                <tr key={med.id} className="hover:bg-slate-50 transition-colors group">
                                                                    <td className="px-6 py-4">
                                                                        <div className="flex flex-col">
                                                                            <span className="font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">{med.brandName}</span>
                                                                            <span className="text-xs text-slate-500">{med.genericName} • {med.strength}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-4">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${med.totalQty === 0 ? 'bg-red-50 text-red-700 border-red-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                                                {med.totalQty} Units
                                                                            </span>
                                                                            {med.expiringSoon && (
                                                                                <span className="px-2.5 py-1 rounded-lg text-xs font-bold border bg-amber-50 text-amber-700 border-amber-100">
                                                                                    Expiring
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-4 text-right">
                                                                        <div className="flex justify-end">
                                                                            {cart.has(med.id) ? (
                                                                                <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                                                                                    <i
                                                                                        onClick={() => handleAddToCart(med.id, (cart.get(med.id) || 0) - 1)}
                                                                                        className="w-7 h-7 cursor-pointer flex items-center justify-center hover:bg-slate-50 rounded-md transition-colors text-slate-600"
                                                                                    >-</i>
                                                                                    <span className="w-8 text-center font-bold text-sm text-slate-800">{cart.get(med.id)}</span>
                                                                                    <i
                                                                                        onClick={() => handleAddToCart(med.id, (cart.get(med.id) || 0) + 1)}
                                                                                        className="w-7 h-7 cursor-pointer flex items-center justify-center hover:bg-slate-50 rounded-md transition-colors text-slate-600"
                                                                                    >+</i>
                                                                                </div>
                                                                            ) : (
                                                                                <button
                                                                                    onClick={() => handleAddToCart(med.id, 1)}
                                                                                    className={`${theme.primary} text-white px-3 py-1.5 rounded-lg text-sm hover:opacity-90 shadow-sm border-none transition-all font-medium`}
                                                                                >
                                                                                    Add to Order
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                            {inventoryList.filter(med =>
                                                                med.brandName.toLowerCase().includes(reorderSearchQuery.toLowerCase()) ||
                                                                med.genericName.toLowerCase().includes(reorderSearchQuery.toLowerCase())
                                                            ).length === 0 && (
                                                                    <tr>
                                                                        <td colSpan={3} className="px-6 py-12 text-center text-slate-400">
                                                                            No medicines found matching your search.
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                        </>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Cart & Details */}
                                <div className="w-full md:w-96 bg-slate-50/50 p-6 flex flex-col border-l border-slate-200">
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex-1 flex flex-col">
                                        <h3 className="font-bold text-slate-800 text-lg mb-6 flex items-center gap-2">
                                            <ClipboardList className="w-5 h-5 text-indigo-500" />
                                            Order Summary
                                        </h3>

                                        <div className="flex-1 space-y-6">
                                            <div>
                                                <div className="flex justify-between items-center mb-2">
                                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Select Supplier</label>
                                                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                                        {data?.lists?.suppliers?.length || 0} Available
                                                    </span>
                                                </div>
                                                <Select value={reorderSupplierId} onValueChange={setReorderSupplierId} disabled={!data?.lists?.suppliers?.length}>
                                                    <SelectTrigger className={`w-full ${theme.primary} text-white border-none h-10 rounded-lg focus:ring-2 focus:ring-white/20`}>
                                                        <SelectValue placeholder="Choose Supplier" />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl border-slate-200 shadow-xl p-1">
                                                        {data?.lists?.suppliers?.map((s) => (
                                                            <SelectItem key={s.id} value={s.id} className={`rounded-lg focus:${theme.light} focus:${theme.text} cursor-pointer`}>
                                                                {s.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {!data?.lists?.suppliers?.length && (
                                                    <p className="text-xs text-red-500 mt-2 font-medium bg-red-50 p-2 rounded-lg border border-red-100 flex items-center gap-2">
                                                        <X className="w-3 h-3" /> No suppliers linked.
                                                    </p>
                                                )}
                                            </div>

                                            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 min-h-[150px] relative">
                                                <label className="absolute -top-2.5 left-3 bg-slate-50 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Items Added</label>
                                                {cart.size === 0 ? (
                                                    <div className="flex flex-col items-center justify-center h-32 text-slate-400 gap-2">
                                                        <ShoppingCart className="w-8 h-8 opacity-20" />
                                                        <span className="text-sm font-medium">Cart is empty</span>
                                                    </div>
                                                ) : (
                                                    <ul className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                                        {Array.from(cart.entries()).map(([id, qty]) => {
                                                            const m = inventoryList.find(x => x.id === id);
                                                            return (
                                                                <li key={id} className="text-sm flex justify-between items-center group">
                                                                    <div className="flex flex-col">
                                                                        <span className="font-bold text-slate-700 truncate max-w-[140px]">{m?.brandName}</span>
                                                                        <span className="text-[10px] text-slate-400">{m?.genericName}</span>
                                                                    </div>
                                                                    <span className="font-mono font-bold text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-sm">x{qty}</span>
                                                                </li>
                                                            )
                                                        })}
                                                    </ul>
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Note (Optional)</label>
                                                <textarea
                                                    className="w-full p-3 text-sm border border-slate-200 rounded-xl resize-none focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all bg-slate-50 focus:bg-white placeholder:text-slate-400"
                                                    rows={3}
                                                    placeholder="Add special instructions for delivery..."
                                                    value={reorderNote}
                                                    onChange={e => setReorderNote(e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        <Button
                                            className={`w-full mt-6 ${theme.primary} text-white hover:opacity-90 border-none h-12 rounded-xl font-bold shadow-lg ${theme.shadow} hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2`}
                                            disabled={cart.size === 0 || !reorderSupplierId}
                                            onClick={handleReorderClick}
                                        >
                                            <Send className="w-4 h-4" />
                                            Send Request ({cart.size} Items)
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* --- NEW SALE (POS) TAB --- */}
                {activeTab === 'sale' && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-3xl shadow-2xl w-full flex flex-col overflow-hidden"
                    >
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">New Sale (POS)</h2>
                                <p className="text-sm text-slate-500">Search medicines and create a receipt.</p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                            {/* Left: Search & Results */}
                            <div className="flex-1 p-6 border-r border-slate-100">
                                <div className="mb-4 relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search to add items..."
                                        value={posQuery}
                                        onChange={(e) => setPosQuery(e.target.value)}
                                        autoFocus
                                        className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm"
                                    />
                                </div>
                                <div className="flex-1 overflow-y-auto max-h-[60vh] custom-scrollbar pr-2 mt-4">
                                    <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                                        <div className="overflow-y-auto custom-scrollbar">
                                            <table className="w-full text-left text-sm relative">
                                                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                                                    <tr>
                                                        <th className="px-6 py-4 font-semibold text-slate-700">Medicine Details</th>
                                                        <th className="px-6 py-4 font-semibold text-slate-700">Stock Status</th>
                                                        <th className="px-6 py-4 font-semibold text-slate-700 text-right">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 bg-white">
                                                    {isPosLoading ? (
                                                        [...Array(5)].map((_, i) => (
                                                            <tr key={i}>
                                                                <td className="px-6 py-4">
                                                                    <div className="space-y-2">
                                                                        <Skeleton className="h-4 w-32" />
                                                                        <Skeleton className="h-3 w-20" />
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <Skeleton className="h-6 w-20 rounded-lg" />
                                                                </td>
                                                                <td className="px-6 py-4 text-right">
                                                                    <div className="flex justify-end">
                                                                        <Skeleton className="h-8 w-24 rounded-lg" />
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    ) : (
                                                        <>
                                                            {posResults.length === 0 && posQuery.length > 0 && (
                                                                <tr>
                                                                    <td colSpan={3} className="text-center text-slate-400 py-12">No medicines found matching "{posQuery}"</td>
                                                                </tr>
                                                            )}
                                                            {posResults.length === 0 && posQuery.length === 0 && (
                                                                <tr>
                                                                    <td colSpan={3} className="text-center text-slate-400 py-12">No medicines available in inventory.</td>
                                                                </tr>
                                                            )}
                                                            {posResults.map((med: any) => {
                                                                const totalStock = med.inventory?.reduce((acc: any, b: any) => acc + b.qtyAvailable, 0) || 0;
                                                                return (
                                                                    <tr key={med.id} className="hover:bg-slate-50 transition-colors group">
                                                                        <td className="px-6 py-4">
                                                                            <div className="flex flex-col">
                                                                                <span className="font-bold text-slate-800">{med.brandName}</span>
                                                                                <span className="text-xs text-slate-500">{med.genericName} • {med.strength}</span>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-6 py-4">
                                                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${totalStock > 0 ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                                                                {totalStock} Units
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-6 py-4 text-right">
                                                                            <div className="flex justify-end">
                                                                                {posCart.has(med.id) ? (
                                                                                    <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                                                                                        <button
                                                                                            onClick={() => handlePOSAddToCart(med, (posCart.get(med.id) || 0) - 1)}
                                                                                            className="w-7 h-7 flex items-center justify-center hover:bg-slate-50 rounded-md transition-colors text-slate-600"
                                                                                        >-</button>
                                                                                        <span className="w-8 text-center font-bold text-sm text-slate-800">{posCart.get(med.id)}</span>
                                                                                        <button
                                                                                            onClick={() => handlePOSAddToCart(med, (posCart.get(med.id) || 0) + 1)}
                                                                                            className="w-7 h-7 flex items-center justify-center hover:bg-slate-50 rounded-md transition-colors text-slate-600"
                                                                                        >+</button>
                                                                                    </div>
                                                                                ) : (
                                                                                    <button
                                                                                        disabled={totalStock <= 0}
                                                                                        onClick={() => handlePOSAddToCart(med, 1)}
                                                                                        className={`${totalStock <= 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : `${theme.primary} text-white hover:opacity-90 shadow-sm`} px-3 py-1.5 rounded-lg text-sm transition-all font-medium border-none`}
                                                                                    >
                                                                                        Add
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right: Cart Receipt */}
                            <div className="w-full md:w-96 bg-slate-50/50 p-6 flex flex-col border-l border-slate-200">
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex-1 flex flex-col">
                                    <h3 className="font-bold text-slate-800 text-lg mb-6 flex items-center gap-2">
                                        <ShoppingCart className={`w-5 h-5 ${theme.text}`} />
                                        Current Sale
                                    </h3>

                                    <div className="flex-1 bg-slate-50 rounded-xl border border-slate-200 p-4 mb-4 overflow-y-auto custom-scrollbar relative">
                                        <label className="absolute -top-2.5 left-3 bg-slate-50 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cart Items</label>
                                        {posCart.size === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                                                <ShoppingCart className="w-8 h-8 opacity-20" />
                                                <p className="text-sm font-medium">Cart is empty</p>
                                            </div>
                                        ) : (
                                            <ul className="space-y-3">
                                                {Array.from(posCart.entries()).map(([id, qty]) => {
                                                    const m = posResults.find(x => x.id === id) || { brandName: "Item info hidden", genericName: "unknown" };
                                                    return (
                                                        <li key={id} className="text-sm flex justify-between items-center group">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-slate-700 truncate max-w-[140px]">{m.brandName}</span>
                                                                <span className="text-[10px] text-slate-400">{m.genericName}</span>
                                                            </div>
                                                            <span className="font-mono font-bold text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-sm">x{qty}</span>
                                                        </li>
                                                    )
                                                })}
                                            </ul>
                                        )}
                                    </div>

                                    {/* Total Placeholders if we had prices */}
                                    {/* <div className="flex justify-between items-center mb-4 text-sm font-bold text-slate-800">
                                    <span>Total</span>
                                    <span>₹0.00</span>
                                </div> */}

                                    <div className="mb-6">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Payment Method</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {["CASH", "CARD", "UPI", "OTHER"].map((method) => (
                                                <button
                                                    key={method}
                                                    onClick={() => setPosPaymentMethod(method)}
                                                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${posPaymentMethod === method
                                                        ? `${theme.primary} text-white border-transparent shadow-md`
                                                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                                        }`}
                                                >
                                                    {method}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <Button
                                        className={`w-full h-12 ${theme.primary} hover:opacity-90 text-white shadow-lg ${theme.shadow} hover:shadow-xl hover:scale-[1.02] transition-all font-bold text-lg border-none rounded-xl`}
                                        disabled={posCart.size === 0 || isCheckoutLoading}
                                        onClick={handlePOSCheckoutClick}
                                    >
                                        {isCheckoutLoading ? "Processing..." : "Checkout & Print"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* --- HISTORY TAB --- */}
                {activeTab === 'history' && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-3xl shadow-2xl w-full flex flex-col overflow-hidden"
                    >
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Sales History</h2>
                                <p className="text-sm text-slate-500">View and download past receipts</p>
                            </div>
                        </div>

                        <div className="flex-1 p-6 bg-slate-50">
                            <div className="bg-white rounded-2xl border border-slate-200 overflow-y-auto max-h-[70vh] shadow-sm custom-scrollbar relative">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 py-4 font-semibold text-slate-700">Receipt Details</th>
                                            <th className="px-6 py-4 font-semibold text-slate-700">Date & Items</th>
                                            <th className="px-6 py-4 font-semibold text-slate-700 text-right">Total Amount</th>
                                            <th className="px-6 py-4 font-semibold text-slate-700 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {isHistoryLoading ? (
                                            [...Array(5)].map((_, i) => (
                                                <tr key={i}>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-4">
                                                            <Skeleton className="w-10 h-10 rounded-xl" />
                                                            <div className="space-y-2">
                                                                <Skeleton className="h-4 w-32" />
                                                                <Skeleton className="h-3 w-24" />
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="space-y-2">
                                                            <Skeleton className="h-4 w-24" />
                                                            <Skeleton className="h-3 w-16" />
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex justify-end">
                                                            <Skeleton className="h-6 w-16 rounded-lg" />
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Skeleton className="w-9 h-9 rounded-lg" />
                                                            <Skeleton className="w-24 h-9 rounded-lg" />
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : receipts.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-12">
                                                    <div className="flex flex-col items-center justify-center text-slate-400 gap-4">
                                                        <div className="bg-slate-50 p-4 rounded-full shadow-sm border border-slate-100">
                                                            <FileText className="w-8 h-8 opacity-50" />
                                                        </div>
                                                        <p>No receipts found.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            receipts.map((receipt) => (
                                                <tr key={receipt.id} className="hover:bg-slate-50 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-10 h-10 rounded-xl ${theme.light} flex items-center justify-center`}>
                                                                <FileText className={`w-5 h-5 ${theme.text}`} />
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-slate-800">
                                                                    {data?.store?.name || 'Store Name'}
                                                                </p>
                                                                <p className="text-xs text-slate-500 font-mono mt-0.5 opacity-75">
                                                                    {receipt.data?.receiptNo || `Receipt #${receipt.id.slice(0, 8)}`}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2 text-slate-600">
                                                                <span className="font-medium bg-slate-100 px-2 py-0.5 rounded text-xs">{new Date(receipt.createdAt).toLocaleDateString()}</span>
                                                                <span className="text-xs text-slate-400">{new Date(receipt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                            <span className="text-xs text-slate-500 font-medium">
                                                                {receipt.data?.items?.length || 0} Items Prescribed
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className="text-lg font-bold text-slate-800">
                                                            ₹{(receipt.data?.total || 0).toLocaleString()}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <i

                                                                onClick={() => downloadReceiptPDF(receipt.id, receipt.data?.receiptNo)}
                                                                className={`w-9 h-9  p-0 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-500`}
                                                                title="Download PDF"
                                                            >
                                                                <Download className="w-4 h-10 cursor-pointer" />
                                                            </i>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => viewReceiptPDF(receipt.id)}
                                                                className={`gap-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 ${theme.text}`}
                                                            >
                                                                <FileText className="w-3.5 h-3.5" /> View PDF
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )))}
                                    </tbody>
                                </table>
                            </div>

                        </div>
                    </motion.div>
                )}


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

                                <div className="p-6 overflow-y-auto custom-scrollbar space-y-8">
                                    {/* Connected Suppliers Section */}


                                    {/* All Suppliers Section */}
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Discover Suppliers</h4>
                                        <div className="space-y-3">
                                            {directorySuppliers.filter(s => s.connectionStatus !== "CONNECTED").length === 0 ? (
                                                <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                                                    <p className="text-slate-400 text-sm">No new suppliers found.</p>
                                                </div>
                                            ) : (
                                                directorySuppliers.filter(s => s.connectionStatus !== "CONNECTED").map(supplier => (
                                                    <div key={supplier.id} className="p-4 rounded-2xl border border-slate-100 bg-white hover:border-indigo-100 hover:shadow-md transition-all flex items-center justify-between group">
                                                        <div>
                                                            <h4 className="font-bold text-slate-800 text-base">{supplier.name}</h4>
                                                            <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                                                                <span>{supplier.contactName || "No Contact"}</span>
                                                                {supplier.phone && <span>• {supplier.phone}</span>}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            {supplier.connectionStatus === "PENDING_OUTBOUND" ? (
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
                                                                            onClick={() => handleDirectoryAccept(supplier.requestId!)}
                                                                        >
                                                                            Accept
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            className="h-7 text-xs border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                                                                            onClick={() => handleDirectoryReject(supplier.requestId!)}
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
                                    </div>
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
                {showDisconnectConfirm && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
                            onClick={() => setShowDisconnectConfirm(false)}
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
                                    <h3 className="text-xl font-bold text-slate-800">Disconnect Supplier?</h3>
                                    <p className="text-slate-500 mt-2 text-sm leading-relaxed">
                                        Are you sure you want to disconnect? You will no longer be able to send reorders to this supplier.
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-3 w-full mt-4">
                                    <Button
                                        variant="outline"
                                        className="h-12 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-semibold"
                                        onClick={() => setShowDisconnectConfirm(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className="h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white border-none shadow-lg shadow-red-500/20 font-semibold"
                                        onClick={executeDisconnectSupplier}
                                    >
                                        Yes, Disconnect
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

            {/* Reorder Confirmation Modal */}
            <AnimatePresence>
                {showReorderConfirm && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
                            onClick={() => setShowReorderConfirm(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm border border-slate-100"
                        >
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className={`w-16 h-16 rounded-2xl ${theme.light} flex items-center justify-center mb-2`}>
                                    <Send className={`w-8 h-8 ${theme.text} translate-x-0.5`} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">Confirm Reorder</h3>
                                    <p className="text-slate-500 mt-2 text-sm leading-relaxed">
                                        Are you sure you want to send this request for <span className="font-bold text-slate-700">{cart.size} items</span>?
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-3 w-full mt-4">
                                    <Button
                                        variant="outline"
                                        className="h-12 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-semibold"
                                        onClick={() => setShowReorderConfirm(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className={`h-12 rounded-xl ${theme.primary} hover:opacity-90 text-white border-none shadow-lg ${theme.shadow} font-semibold`}
                                        onClick={() => {
                                            executeReorder();
                                            setShowReorderConfirm(false);
                                        }}
                                    >
                                        Confirm
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* POS Confirmation Modal */}
            <AnimatePresence>
                {showPOSConfirm && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
                            onClick={() => setShowPOSConfirm(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm border border-slate-100"
                        >
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className={`w-16 h-16 rounded-2xl ${theme.light} flex items-center justify-center mb-2`}>
                                    <ShoppingCart className={`w-8 h-8 ${theme.text}`} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">Confirm Sale</h3>
                                    <p className="text-slate-500 mt-2 text-sm leading-relaxed">
                                        Are you sure you want to process this sale for <span className="font-bold text-slate-700">{posCart.size} items</span>?
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-3 w-full mt-4">
                                    <Button
                                        variant="outline"
                                        className="h-12 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-semibold"
                                        onClick={() => setShowPOSConfirm(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className={`h-12 rounded-xl ${theme.primary} hover:opacity-90 text-white border-none shadow-lg ${theme.shadow} font-semibold`}
                                        onClick={() => {
                                            executeCheckout();
                                            setShowPOSConfirm(false);
                                        }}
                                    >
                                        Confirm
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Receipt Preview Modal */}
            <AnimatePresence>
                {showReceiptPreview && currentReceiptUrl && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg md:max-w-4xl flex flex-col overflow-hidden h-[90vh]"
                        >
                            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-emerald-50/50">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                                    Receipt Generated
                                </h3>
                                <button onClick={() => setShowReceiptPreview(false)} className="p-1 hover:bg-slate-200 rounded-full">
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>

                            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                                {/* PDF Preview */}
                                <div className="flex-1 bg-slate-100 p-4 flex items-center justify-center border-r border-slate-100">
                                    <iframe
                                        src={currentReceiptUrl + "#toolbar=0"}
                                        className="w-full h-full rounded-lg shadow-sm bg-white"
                                        title="Receipt Preview"
                                    />
                                </div>

                                {/* Actions */}
                                <div className="w-full md:w-72 bg-white p-6 flex flex-col shrink-0 overflow-y-auto">
                                    <h4 className="font-bold text-slate-700 mb-4">Actions</h4>

                                    <div className="mb-6">
                                        <label className="block text-sm font-medium text-slate-600 mb-2">Send Receipt to Email</label>
                                        <div className="flex flex-col gap-2">
                                            <input
                                                type="email"
                                                placeholder="customer@example.com"
                                                value={receiptEmail}
                                                onChange={(e) => setReceiptEmail(e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                            />
                                            <Button
                                                onClick={handleSendReceipt}
                                                disabled={isSendingEmail || !receiptEmail}
                                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200"
                                                size="sm"
                                            >
                                                {isSendingEmail ? "Sending..." : "Send Email"}
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="mt-auto pt-6 border-t border-slate-100">
                                        <p className="text-xs text-slate-400 text-center mb-3">Or download directly</p>
                                        <a
                                            href={currentReceiptUrl}
                                            download={`Receipt-${Date.now()}.pdf`}
                                            className="block w-full text-center py-2 px-4 border border-slate-200 rounded-lg text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                                        >
                                            Download PDF
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>


            {/* Disconnect Supplier Confirmation Modal */}
            <AnimatePresence>
                {showDisconnectConfirm && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
                            onClick={() => setShowDisconnectConfirm(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm border border-slate-100"
                        >
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className={`w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-2`}>
                                    <Trash2 className={`w-8 h-8 text-red-500`} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">Disconnect Supplier?</h3>
                                    <p className="text-slate-500 mt-2 text-sm leading-relaxed">
                                        Are you sure you want to remove this supplier from your network? You will need to request a connection again to reorder.
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-3 w-full mt-4">
                                    <Button
                                        variant="outline"
                                        className="h-12 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-semibold"
                                        onClick={() => setShowDisconnectConfirm(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className={`h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white border-none shadow-lg shadow-red-200 font-semibold`}
                                        onClick={() => {
                                            if (disconnectSupplierId) {
                                                executeDisconnectSupplier();
                                            }
                                        }}
                                    >
                                        Disconnect
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Reorder Details Modal */}
            <AnimatePresence>
                {showReorderDetails && selectedReorder && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 z-[200]">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"
                            onClick={() => setShowReorderDetails(false)}
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[85vh] flex flex-col z-10"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="text-xl font-bold text-slate-800">Order Details</h3>
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${selectedReorder.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                            selectedReorder.status === 'REJECTED' ? 'bg-red-100 text-red-700 border-red-200' :
                                                'bg-amber-100 text-amber-700 border-amber-200'
                                            }`}>
                                            {selectedReorder.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500 font-mono">#{selectedReorder.id.slice(0, 8).toUpperCase()}</p>
                                </div>
                                <button
                                    onClick={() => setShowReorderDetails(false)}
                                    className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>

                            <div className="overflow-y-auto p-6 space-y-6">
                                {/* Info Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                        <div className="flex items-center gap-2 mb-2 text-slate-400 text-xs font-bold uppercase tracking-wider">
                                            <Store className="w-3.5 h-3.5" /> Supplier
                                        </div>
                                        <p className="font-semibold text-slate-700">
                                            {data?.lists?.suppliers?.find(s => s.id === selectedReorder.supplierId)?.name || 'Unknown Supplier'}
                                        </p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                        <div className="flex items-center gap-2 mb-2 text-slate-400 text-xs font-bold uppercase tracking-wider">
                                            <Calendar className="w-3.5 h-3.5" /> Date Sent
                                        </div>
                                        <p className="font-semibold text-slate-700">
                                            {new Date(selectedReorder.createdAt).toLocaleDateString()} at {new Date(selectedReorder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>

                                {/* Items List */}
                                <div>
                                    <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                        <Package className="w-4 h-4 text-slate-400" />
                                        Requested Items
                                        <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                            {selectedReorder.payload?.items?.length || 0}
                                        </span>
                                    </h4>
                                    <div className="border border-slate-200 rounded-2xl overflow-hidden">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 text-slate-500 font-medium">
                                                <tr>
                                                    <th className="px-4 py-3 pl-6">Medicine Name</th>
                                                    <th className="px-4 py-3 text-right pr-6">Quantity</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {selectedReorder.payload?.items?.map((item: any, idx: number) => (
                                                    <tr key={idx} className="hover:bg-slate-50/50">
                                                        <td className="px-4 py-3 pl-6 font-medium text-slate-700">{item.medicineName}</td>
                                                        <td className="px-4 py-3 text-right pr-6 font-mono text-slate-600">{item.quantity}</td>
                                                    </tr>
                                                ))}
                                                {(!selectedReorder.payload?.items || selectedReorder.payload.items.length === 0) && (
                                                    <tr>
                                                        <td colSpan={2} className="px-4 py-8 text-center text-slate-400">
                                                            No items listed in this request.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Note (if applicable) */}
                                {selectedReorder.payload?.note && (
                                    <div className="p-4 bg-yellow-50 rounded-2xl border border-yellow-100 text-sm text-yellow-800">
                                        <span className="font-bold block mb-1">Note:</span>
                                        {selectedReorder.payload.note}
                                    </div>
                                )}
                            </div>

                            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                                <Button
                                    onClick={() => setShowReorderDetails(false)}
                                    className="px-6 rounded-xl font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
                                >
                                    Close
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>


            {/* Dock Navigation */}
            <div className="fixed left-6 top-1/2 -translate-y-1/2 z-50 flex flex-col justify-center pointer-events-none">
                <div className="pointer-events-auto">
                    <Dock direction="vertical" panelHeight={60} magnification={70} className="bg-white/80 backdrop-blur-xl shadow-2xl rounded-2xl dark:bg-white/80">
                        {NAV_ITEMS.map((item) => (
                            <DockItem
                                key={item.tab}
                                onClick={() => {
                                    if (item.tab === 'reorder') { handleOpenReorder(); }
                                    else if (item.tab === 'sale') { searchPOSMedicines(""); }
                                    else if (item.tab === 'history') { handleViewReceipts(); }
                                    setActiveTab(item.tab as any);
                                }}
                            >
                                <DockLabel>{item.label}</DockLabel>
                                <DockIcon>
                                    <item.icon className={`w-6 h-6 transition-colors duration-300 ${activeTab === item.tab ? item.color : 'text-slate-400'}`} />
                                </DockIcon>
                            </DockItem>
                        ))}
                    </Dock>
                </div>
            </div>
        </div >
    );
};







export default StoreOwnerDashboard;
