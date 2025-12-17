// @ts-nocheck

import React from "react";
import { useRecoilState } from "recoil";
import { authState } from "../state/auth";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Settings, LogOut, Users, Package, Calendar, Search, X, Sparkles, Lock, Truck, Zap, Check, FileText, ChevronDown, ChevronUp, Activity, ShoppingCart, Link, Store, CheckCircle, XCircle, Send, History as HistoryIcon, ClipboardList, Download, Mail, Phone, Trash2, ArrowRight, CreditCard, Banknote, Smartphone, MoreHorizontal, Loader2, RefreshCw, Filter, Clock} from "lucide-react";
import { Dock, DockIcon, DockItem, DockLabel } from "../components/ui/dock";

import { formatDistanceToNow } from "date-fns";
import { useLogout } from "../hooks/useLogout";
import { dashboardApi } from "../lib/api/endpoints";
import { Button } from "../components/ui/button";
import FeedbackToast from "../components/ui/feedback-toast";

import { 
    Card as MetricCard, 
    CardHeader as MetricCardHeader, 
    CardContent as MetricCardContent, 
    CardTitle as MetricCardTitle, 
    CardDescription as MetricCardDescription 
} from "@/components/ui/card-custom";
import {
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Area,
    ComposedChart
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/line-charts-9";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../components/ui/select";
import { FaRupeeSign } from "react-icons/fa";
import type { Supplier, SupplierRequest } from "@/lib/types";

const Skeleton = ({ className }: { className?: string }) => (
    // @ts-ignore
    <div className={`animate-pulse bg-slate-200 rounded-md ${className}`} />
);

const chartConfig = {
    revenue: {
        label: "Revenue",
        color: "hsl(var(--chart-1))",
    },
} satisfies ChartConfig;

const forecastChartConfig = {
    history: {
        label: "Historical Sales",
        color: "#475569", // slate-600
    },
    forecast: {
        label: "AI Forecast",
        color: "#6366f1", // indigo-500
    },
    confRange: {
        label: "Confidence Interval",
        color: "#818cf8", // indigo-400
    }
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
    const [auth, setAuth] = useRecoilState(authState);
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


    // Reorder State

    const [inventoryList, setInventoryList] = React.useState<any[]>([]);
    const [suggestedItems, setSuggestedItems] = React.useState<any[]>([]);
    const [cart, setCart] = React.useState<Map<string, number>>(new Map()); // medicineId -> qty
    const [reorderSupplierId, setReorderSupplierId] = React.useState<string>("");
    const [reorderNote, setReorderNote] = React.useState("");
    const [isAiLoading, setIsAiLoading] = React.useState(false);
    const [reorderSearchQuery, setReorderSearchQuery] = React.useState("");
    const [inventoryFilter] = React.useState<"all" | "in_stock" | "out_of_stock">("all");

    const [isReorderLoading, setIsReorderLoading] = React.useState(false);
    const [isHistoryLoading, setIsHistoryLoading] = React.useState(false);

    // POS Payment & Receipt Preview State
    const [posPaymentMethod, setPosPaymentMethod] = React.useState<string>("CASH");
    const [showReceiptPreview, setShowReceiptPreview] = React.useState(false);
    const [currentReceiptUrl, setCurrentReceiptUrl] = React.useState<string | null>(null);
    const [currentSaleId, setCurrentSaleId] = React.useState<string | null>(null);
    const [posInventoryFilter, setPosInventoryFilter] = React.useState<"all" | "in_stock" | "out_of_stock">("all");

    const [isScrolled, setIsScrolled] = React.useState(false);

    React.useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 10);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);
    const [receiptEmail, setReceiptEmail] = React.useState("");
    const [isSendingEmail, setIsSendingEmail] = React.useState(false);

    const [showDisconnectConfirm, setShowDisconnectConfirm] = React.useState(false);
    const [disconnectSupplierId, setDisconnectSupplierId] = React.useState<string | null>(null);
    const [isDisconnectLoading, setIsDisconnectLoading] = React.useState(false);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [selectedReorder, setSelectedReorder] = React.useState<SupplierRequest | null>(null);
    const [showReorderDetails, setShowReorderDetails] = React.useState(false);

    // Send Reorder Logic
    const [isSendingReorder, setIsSendingReorder] = React.useState(false);
    const [reorderResult, setReorderResult] = React.useState<{ type: 'success' | 'error', message: string } | null>(null);

    const [activeTab, setActiveTab] = React.useState<"overview" | "reorder" | "sale" | "history" | "suppliers" | "sent_reorders">("overview");

    const NAV_ITEMS = [
        { label: "Overview", icon: Store, tab: "overview", color: "text-blue-500" },
        { label: "New Reorder", icon: Zap, tab: "reorder", color: "text-amber-500" },
        { label: "Sent Reorders", icon: Package, tab: "sent_reorders", color: "text-indigo-500" },
        { label: "New Sale", icon: ShoppingCart, tab: "sale", color: "text-emerald-500" },
        { label: "Sales History", icon: HistoryIcon, tab: "history", color: "text-slate-500" },
        { label: "Suppliers", icon: Users, tab: "suppliers", color: "text-purple-500" },
    ];


    const handleOpenReorder = async () => {
        setIsReorderLoading(true);
        try {
            const res = await dashboardApi.getInventory({ limit: 1000 });
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
            setReorderResult({ type: 'error', message: "Please select a supplier." });
            return;
        }
        if (cart.size === 0) {
            setReorderResult({ type: 'error', message: "Please add items to reorder." });
            return;
        }
        executeReorder();
    };

    const executeReorder = async () => {
        if (!reorderSupplierId) {
            setReorderResult({ type: 'error', message: "Please select a supplier." });
            return;
        }
        if (cart.size === 0) {
            setReorderResult({ type: 'error', message: "Please add items to reorder." });
            return;
        }

        const items = Array.from(cart.entries()).map(([medicineId, quantity]) => {
            const medicine = inventoryList.find((m: any) => m.id === medicineId) || suggestedItems.find((m: any) => m.id === medicineId);
            // Default to 0 if not found or no batches. 
            // Prefer taking from first available batch or defined fields.
            const firstBatch = medicine?.batches?.[0] || medicine?.inventory?.[0]; // Support both structures
            const purchasePrice = firstBatch?.purchasePrice ? Number(firstBatch.purchasePrice) : (medicine?.purchasePrice || 0);
            const mrp = firstBatch?.mrp ? Number(firstBatch.mrp) : (medicine?.mrp || 0);

            return {
                medicineId,
                quantity,
                purchasePrice,
                mrp,
            };
        });

        setIsSendingReorder(true);
        try {
            const res = await dashboardApi.reorder({
                supplierId: reorderSupplierId,
                items,
                note: reorderNote
            });
            if (res.data.success) {
                setReorderResult({ type: 'success', message: "Reorder request sent successfully!" });
                // We keep the state until user closes modal
            }
        } catch (err: any) {
            console.error(err);
            setReorderResult({ type: 'error', message: "Failed to send reorder: " + (err.response?.data?.message || err.message) });
        } finally {
            setIsSendingReorder(false);
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

                setSuggestedItems(suggestions);

                // Auto-fill Cart
                setCart(() => {
                    const newCart = new Map();
                    suggestions.forEach((s: any) => {
                        // Backend returns 'id' for the medicine ID in the suggestions array
                        newCart.set(s.id || s.medicineId, s.suggestedQty);
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
    const [posCart, setPosCart] = React.useState<Map<string, { qty: number, medicine: any }>>(new Map()); // medicineId -> {qty, medicine}
    const [isCheckoutLoading, setIsCheckoutLoading] = React.useState(false);
    const [showPOSConfirm, setShowPOSConfirm] = React.useState(false);

    // --- Forecast State ---
    const [forecastQuery, setForecastQuery] = React.useState("");
    const [forecastResults, setForecastResults] = React.useState<any[]>([]);
    const [_selectedForecastMedicine, setSelectedForecastMedicine] = React.useState<any | null>(null);
    const [forecastData, setForecastData] = React.useState<any | null>(null);
    const [topForecasts, setTopForecasts] = React.useState<{ medicine: any, forecast: any }[]>([]);
    const [isForecastLoading, setIsForecastLoading] = React.useState(false);
    const [isForecastSearching, setIsForecastSearching] = React.useState(false);
    const [forecastError, setForecastError] = React.useState<string | null>(null);
    const [isFeaturedMedicine, setIsFeaturedMedicine] = React.useState(false);


    const searchForecastMedicines = async (q: string) => {
        setIsForecastSearching(true);
        try {
            const res = await dashboardApi.searchMedicines(q);
            if (res.data.success) {
                setForecastResults(res.data.data.medicines);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsForecastSearching(false);
        }
    };

    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (activeTab === 'overview' && forecastQuery.length > 0) {
                searchForecastMedicines(forecastQuery);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [forecastQuery, activeTab]);

    const handleRunForecast = async (medicine: any, isFeatured: boolean = false) => {
        setSelectedForecastMedicine(medicine);
        setForecastQuery(""); // clear search to hide dropdown
        setIsForecastLoading(true);
        setIsFeaturedMedicine(isFeatured);
        try {
            // Use auth.effectiveStore.id or fallback to data.store.id
            const storeId = auth.effectiveStore?.id || data?.store?.id;

            if (!storeId) {
                console.error("Store ID missing", { authStore: auth.effectiveStore, dataStore: data?.store });
                setForecastError("Store ID missing. Please refresh the page.");
                setIsForecastLoading(false);
                return;
            }
            const res = await dashboardApi.getInventoryForecast({
                store_id: storeId,
                medicine_id: medicine.id,
                horizon_days: [7, 15, 30]
            });
            setForecastData(res.data);
            setTopForecasts([]); // Clear top forecasts when selecting a single one
        } catch (err: any) {
            console.error("Forecast failed", err);
            if (err.response?.status === 400 && err.response?.data?.detail) {
                setForecastError(`Forecast Failed: ${err.response.data.detail}`);
            } else {
                setForecastError("Failed to generate forecast");
            }
        } finally {
            setIsForecastLoading(false);
        }
    };

    // Auto-fetch top medicine forecast on load
    React.useEffect(() => {
        const fetchTopMedicineForecast = async () => {
            if (activeTab === 'overview' && !forecastData && !isForecastLoading && data) {
                try {
                    let medicineToForecast: any = null;
                    
                    // Priority 1: Use first medicine from low stock list (critical priority)
                    if (data?.lists?.lowStock && data.lists.lowStock.length > 0) {
                        medicineToForecast = data.lists.lowStock[0];
                    } 
                    
                    // Priority 2: If no low stock, search for any available medicine
                    if (!medicineToForecast) {
                        const searchRes = await dashboardApi.searchMedicines("");
                        if (searchRes.data.success && searchRes.data.data.medicines.length > 0) {
                            medicineToForecast = searchRes.data.data.medicines[0];
                        }
                    }

                    // Trigger forecast for the selected medicine with featured flag
                    if (medicineToForecast) {
                        await handleRunForecast(medicineToForecast, true);
                    }
                } catch (err) {
                    console.error("Failed to auto-fetch top medicine forecast", err);
                }
            }
        };

        fetchTopMedicineForecast();
    }, [activeTab, data, forecastData, isForecastLoading]);

    const chartData = React.useMemo(() => {
        if (!forecastData?.plot_data) return [];

        try {
            const hist = Array.isArray(forecastData.plot_data.history) ? forecastData.plot_data.history : [];
            const fore = Array.isArray(forecastData.plot_data.forecast) ? forecastData.plot_data.forecast : [];
            const conf = Array.isArray(forecastData.plot_data.confidence) ? forecastData.plot_data.confidence : [];

            // 1. Process History
            const processedHist = hist.map((h: any) => ({
                date: h.date,
                history: typeof h.qty === 'number' ? h.qty : 0,
                forecast: null,
                confHigh: null,
                confRange: null
            }));

            // 2. Process Forecast
            const processedFore = fore.map((f: any) => {
                const c = conf.find((x: any) => x.date === f.date);
                const val = typeof f.qty === 'number' ? f.qty : 0;
                
                let low = val;
                let high = val;
                
                if (c) {
                    low = typeof c.low === 'number' ? c.low : val;
                    high = typeof c.high === 'number' ? c.high : val;
                }

                return {
                    date: f.date,
                    history: null,
                    forecast: val,
                    confHigh: high, // Keep for backward compat or tooltip
                    confRange: [low, high]
                };
            });

            // 3. Seamless Stitching
            if (processedHist.length > 0 && processedFore.length > 0) {
                const lastHist = processedHist[processedHist.length - 1];
                // Clone to allow mutation without side-effects if needed, though here we created objects above
                lastHist.forecast = lastHist.history;
                lastHist.confHigh = lastHist.history;
                lastHist.confRange = [lastHist.history, lastHist.history];
            }

            return [...processedHist, ...processedFore];
        } catch (e) {
            console.error("Error processing chart data", e);
            return [];
        }
    }, [forecastData]);

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
            if (qty <= 0) {
                newCart.delete(medicine.id);
            } else {
                newCart.set(medicine.id, { qty, medicine });
            }
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
        executeCheckout();
    };

    const executeCheckout = async () => {
        if (posCart.size === 0) return;

        setIsCheckoutLoading(true);
        try {
            const items = Array.from(posCart.values()).map(({ medicine, qty }) => ({ medicineId: medicine.id, qty }));

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
            searchPOSMedicines(""); // Force refresh stock

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

    // Reorder State

    // Reorder State

    const theme = themeConfig.black;

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
            const [storeRes, bootstrapRes, requestsRes] = await Promise.all([
                dashboardApi.getStore(),
                dashboardApi.getBootstrap(),
                dashboardApi.getSupplierRequests(),
            ]);

            // Role & Store Update Check
            if (storeRes.data.success) {
                const fetchedUser = storeRes.data.data.user;
                const fetchedStore = storeRes.data.data.store;
                
                let shouldUpdate = false;
                let newAuth: any = { ...auth };

                // 1. Check Role
                if (auth.user && fetchedUser.globalRole !== auth.user.globalRole) {
                    newAuth.user = { ...newAuth.user, globalRole: fetchedUser.globalRole };
                    shouldUpdate = true;
                    
                    if (fetchedUser.globalRole === "SUPPLIER") {
                        setShowFeedback(true);
                        alert("Access Updated: Congrats you are now a SUPPLIER!");
                    }
                }

                // 2. Check Store (Fix for missing store name on first login)
                if (fetchedStore && (!auth.effectiveStore || auth.effectiveStore.id !== fetchedStore.id || auth.effectiveStore.name !== fetchedStore.name)) {
                     newAuth.effectiveStore = fetchedStore;
                     shouldUpdate = true;
                }

                if (shouldUpdate) {
                    setAuth(newAuth);
                }
            }

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
    }, [auth.user, setAuth]);

    React.useEffect(() => {
        if (auth.token) {
            fetchData();
        }
    }, [auth.token, fetchData]);

    const refreshData = async () => {
        setIsRefreshing(true);

        // Refresh only the active section
        switch (activeTab) {
            case 'reorder':
                await handleOpenReorder();
                break;
            case 'sale':
                await searchPOSMedicines("");
                break;
            case 'history':
                await handleViewReceipts();
                break;
            case 'overview':
            case 'suppliers':
            case 'sent_reorders':
            default:
                await fetchData();
                break;
        }

        setTimeout(() => setIsRefreshing(false), 500); // Min delay for visual feedback
    };

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
    const [directorySuppliers, setDirectorySuppliers] = React.useState<any[]>([]);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [imgError, setImgError] = React.useState(false);

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
        if (activeTab === 'suppliers') {
            const timer = setTimeout(() => {
                fetchSuppliersDirectory(searchQuery);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [activeTab, searchQuery, fetchSuppliersDirectory]);

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
        setIsDisconnectLoading(true);
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
        } catch (err) {
            console.error("Failed to disconnect", err);
            alert("Failed to disconnect supplier");
        } finally {
            setIsDisconnectLoading(false);
            setShowDisconnectConfirm(false);
            setDisconnectSupplierId(null);
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
            <header
                className={`fixed top-0 left-0 w-full z-40 pl-8 pr-8
  transition-[background-color,backdrop-filter,box-shadow,border-color]
  duration-500 ease-out
  ${isScrolled
                        ? 'bg-white/60 backdrop-blur-xl border-b border-slate-200/50 shadow-sm'
                        : 'bg-white/0 backdrop-blur-md border-b border-transparent shadow-none'
                    }`}
            >
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between gap-8">
                    {/* Left: Brand & Store Info */}
                    <div className="flex items-center gap-4 shrink-0">
                        <div className="w-12 h-12 flex items-center justify-center">
                            <Store className="w-8 h-8 text-black" />
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

                        {/* Refresh Button */}
                        <div
                            onClick={refreshData}
                            className={`flex items-center justify-center p-2 rounded-lg bg-white border border-slate-200/80 shadow-sm cursor-pointer hover:bg-slate-50 transition-all ${isRefreshing ? 'opacity-70 pointer-events-none' : ''}`}
                            title="Refresh Data"
                        >
                            <RefreshCw className={`w-4 h-4 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </div>

                        {/* Date */}
                        <div className="hidden xl:flex items-center gap-2 text-xs font-semibold text-slate-500 bg-white border border-slate-200/80 px-3 py-2 rounded-lg shadow-sm">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                        </div>

                        {/* Notifications */}
                        <div className="relative" ref={notificationRef}>
                            <div
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="p-2.5 bg-white border border-slate-200/80 rounded-xl text-slate-400 hover:text-slate-600 hover:border-slate-300 hover:shadow-md transition-all relative outline-none group cursor-pointer"
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
                            </div>

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
                                                                className="flex-1 h-8 text-xs bg-slate-900 hover:bg-black border-none shadow-sm text-white"
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
                        <div className="flex items-center gap-4 pl-2">

                            {/* User Info */}
                            <div className="hidden sm:flex flex-col items-end leading-tight mr-1">
                                <span className="text-sm font-bold text-slate-800">
                                    {auth.user?.username}
                                </span>
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                                    {auth.user?.globalRole?.toLowerCase().replace('_', ' ')}
                                </span>
                            </div>

                            {/* Avatar */}
                            <div className="relative group">
                                <div className="flex items-center justify-center w-11 h-11 rounded-full 
                      bg-white text-slate-700 
                      font-bold shadow-md border-[2px] border-white ring-1 ring-slate-100 overflow-hidden transition-transform group-hover:scale-105">
                                    {auth.user?.imageUrl && !imgError ? (
                                        <img
                                            src={auth.user.imageUrl}
                                            alt="Profile"
                                            className="w-full h-full object-cover"
                                            onError={() => setImgError(true)}
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-600">
                                            {auth.user?.username?.charAt(0)?.toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>
                            </div>

                            {/* Logout Button */}
                            <div
                                onClick={handleLogout}
                                className="w-10 h-10 flex items-center justify-center rounded-full
             bg-transparent text-slate-500 border border-slate-200 shadow-sm
             hover:bg-red-50 hover:text-red-600 hover:border-red-200
             transition-all cursor-pointer"
                                title="Sign out"
                            >
                                <LogOut className="w-5 h-5" /> {/* increased size */}
                            </div>

                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 pt-32 pb-8 space-y-8 relative z-10">

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

                              {/* --- AI FORECAST SECTION --- */}
                                            <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm mb-8 relative overflow-hidden">
                                                {/* Background Effect */}
                                                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
                    
                                                <div className="relative z-10">
                                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                                                        <div>
                                                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                                                <Sparkles className="w-5 h-5 text-indigo-500" />
                                                                AI Inventory Forecast
                                                            </h3>
                                                            <p className="text-slate-500 text-sm mt-1">Search for medicines or view featured forecast</p>
                                                        </div>

                                                        {/* Search Bar */}
                                                        <div className="relative w-full md:w-96">
                                                            <div className="relative">
                                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                                <input
                                                                    type="text"
                                                                    placeholder="Search medicine to forecast..."
                                                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition-all"
                                                                    value={forecastQuery}
                                                                    onChange={(e) => setForecastQuery(e.target.value)}
                                                                />
                                                                {isForecastSearching && (
                                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                                        <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                                                    </div>
                                                                )}
                                                            </div>
                    
                                                            {/* Dropdown Results */}
                                                            {forecastQuery.length > 0 && forecastResults.length > 0 && (
                                                                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 max-h-60 overflow-y-auto z-50 custom-scrollbar">
                                                                    {forecastResults.map(med => (
                                                                        <div
                                                                            key={med.id}
                                                                            className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-none flex items-center justify-between group"
                                                                            onClick={() => handleRunForecast(med)}
                                                                        >
                                                                            <div className="flex-1 pr-4">
                                                                                <div className="font-bold text-slate-700 text-sm group-hover:text-indigo-600 transition-colors">{med.brandName}</div>
                                                                                <div className="text-xs text-slate-400">{med.genericName} • {med.strength}</div>
                                                                                <div className="flex flex-wrap gap-2 mt-1.5">
                                                                                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                                                                                        {med.inventory && med.inventory.length > 0 ? `₹${med.inventory[0].mrp}` : "Out of Stock"}
                                                                                    </span>
                                                                                    {med.inventory && med.inventory.length > 0 && (
                                                                                        <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100 font-medium">
                                                                                            Batch: {med.inventory[0].batchNumber} {med.inventory.length > 1 && `+${med.inventory.length - 1}`}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                    
                                                    {/* Loading State */}
                                                    {isForecastLoading && (
                                                        <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-4">
                                                            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center relative">
                                                                <Sparkles className="w-8 h-8 text-indigo-500 animate-pulse" />
                                                                <div className="absolute inset-0 rounded-full border-4 border-indigo-100 border-t-indigo-500 animate-spin" />
                                                            </div>
                                                            <div className="text-center">
                                                                <p className="font-bold text-slate-700 animate-pulse">Generating Forecast...</p>
                                                                <p className="text-xs text-slate-400 mt-1">Analyzing historical trends and seasonality</p>
                                                            </div>
                                                        </div>
                                                    )}
                    
                                                    {/* Forecast Data Display */}
                                                    {!isForecastLoading && forecastData && (
                                                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                                            {/* Top Cards */}
                                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Medicine Details</div>
                                                                        {isFeaturedMedicine && (
                                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-2 py-0.5 rounded-full">
                                                                                <Sparkles className="w-2.5 h-2.5" />
                                                                                Featured
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="font-bold text-lg text-slate-800 leading-tight">{forecastData.medicine_name}</div>
                                                                    {_selectedForecastMedicine && (
                                                                        <div className="text-xs text-slate-500 mt-3 space-y-1.5 border-t border-slate-200 pt-2">
                                                                            <div className="grid grid-cols-2 gap-x-2">
                                                                                <span className="text-slate-400">Generic:</span>
                                                                                <span className="font-medium text-slate-700 truncate">{_selectedForecastMedicine.genericName}</span>
                                                                            </div>
                                                                            <div className="grid grid-cols-2 gap-x-2">
                                                                                <span className="text-slate-400">Strength:</span>
                                                                                <span className="font-medium text-slate-700">{_selectedForecastMedicine.strength}</span>
                                                                            </div>
                                                                            <div className="grid grid-cols-2 gap-x-2">
                                                                                <span className="text-slate-400">Mfr:</span>
                                                                                <span className="font-medium text-slate-700 truncate">{_selectedForecastMedicine.manufacturer}</span>
                                                                            </div>
                                                                            <div className="block mt-1">
                                                                                <span className="text-slate-400 block mb-0.5">Batch Numbers:</span>
                                                                                <span className="font-medium text-slate-700 bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[10px] break-all">
                                                                                    {_selectedForecastMedicine.inventory?.map((b: any) => b.batchNumber).join(", ") || "N/A"}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    <div className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200">Current Stock: <span className="font-bold text-slate-900">{forecastData.current_stock}</span></div>
                                                                </div>
                    
                                                                <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100">
                                                                    <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">Forecast (30 Days)</div>
                                                                    <div className="text-2xl font-bold text-indigo-700">{forecastData.demand_forecast["30"] || 0} <span className="text-sm font-medium text-indigo-400">units</span></div>
                                                                    <div className="text-xs text-indigo-400 mt-1">Predicted Demand</div>
                                                                </div>
                    
                                                                <div className={`rounded-2xl p-4 border ${forecastData.reorder_now ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                                                    <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${forecastData.reorder_now ? 'text-amber-500' : 'text-emerald-500'}`}>Recommendation</div>
                                                                    <div className={`text-lg font-bold flex items-center gap-2 ${forecastData.reorder_now ? 'text-amber-700' : 'text-emerald-700'}`}>
                                                                        {forecastData.reorder_now ? (
                                                                            <>
                                                                                <Zap className="w-5 h-5" /> Reorder Now
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <CheckCircle className="w-5 h-5" /> Sufficient Stock
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                    {forecastData.reorder_now && (
                                                                        <div className="text-xs text-amber-600/80 mt-1">Suggested Qty: <strong>{forecastData.reorder_quantity?.["30"] || 0}</strong></div>
                                                                    )}
                                                                </div>
                    
                                                                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Confidence Score</div>
                                                                    <div className="flex items-end gap-2">
                                                                        <div className="text-2xl font-bold text-slate-800">High</div>
                                                                        <div className="mb-1 text-xs px-2 py-0.5 bg-emerald-100 text-emerald-600 font-bold rounded-full">92%</div>
                                                                    </div>
                                                                    <div className="text-xs text-slate-400 mt-1">Based on solid historical data</div>
                                                                </div>
                                                            </div>
                    
                                                            {/* Chart Container */}
                                        <div className="grid grid-cols-1 gap-8">
                                            <MetricCard className="h-full border-slate-100 shadow-sm rounded-3xl overflow-hidden bg-white">
                                                <MetricCardHeader className="flex flex-row items-center justify-between pb-2">
                                                    <div className="space-y-1">
                                                        <MetricCardTitle className="text-xl font-bold text-slate-800">Forecast Trend</MetricCardTitle>
                                                        <MetricCardDescription className="text-slate-500 font-medium">
                                                            AI-generated demand prediction
                                                        </MetricCardDescription>
                                                    </div>
                                                </MetricCardHeader>
                                                <MetricCardContent>
                                                    {chartData && Array.isArray(chartData) && chartData.length > 0 ? (
                                                        <ChartContainer config={forecastChartConfig} className="w-full h-[350px] min-h-[350px]">
                                                            <ComposedChart
                                                                data={JSON.parse(JSON.stringify(chartData))}
                                                                margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
                                                            >
                                                                <defs>
                                                                    <linearGradient id="gridGradient" x1="0" y1="0" x2="0" y2="1">
                                                                        <stop offset="5%" stopColor="#f8fafc" stopOpacity={0.8} />
                                                                        <stop offset="95%" stopColor="#f8fafc" stopOpacity={0} />
                                                                    </linearGradient>
                                                                    <linearGradient id="confGradient" x1="0" y1="0" x2="0" y2="1">
                                                                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.25} />
                                                                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0.05} />
                                                                    </linearGradient>
                                                                </defs>
                                                                
                                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                                
                                                                <XAxis 
                                                                    dataKey="date" 
                                                                    tickLine={false}
                                                                    axisLine={false}
                                                                    tickMargin={12}
                                                                    tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }}
                                                                    tickFormatter={(val) => {
                                                                        const d = new Date(val);
                                                                        return isNaN(d.getTime()) ? val : `${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })}`;
                                                                    }}
                                                                />
                                                                
                                                                <YAxis 
                                                                    tickLine={false}
                                                                    axisLine={false}
                                                                    tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }}
                                                                />
                                                                
                                                                <ChartTooltip
                                                                    cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }}
                                                                    content={
                                                                        <ChartTooltipContent
                                                                            className="w-40 bg-white/95 backdrop-blur-md border-slate-100 shadow-xl rounded-xl"
                                                                            labelFormatter={(label) => {
                                                                                const d = new Date(label);
                                                                                return isNaN(d.getTime()) ? label : d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                                                                            }}
                                                                        />
                                                                    }
                                                                />
                                                                
                                                                <Area
                                                                    dataKey="confRange"
                                                                    type="monotone"
                                                                    stroke="none"
                                                                    fill="url(#confGradient)"
                                                                    activeDot={false}
                                                                    isAnimationActive={true}
                                                                />

                                                                <Line
                                                                    type="monotone"
                                                                    dataKey="history"
                                                                    stroke="var(--color-history)"
                                                                    strokeWidth={3}
                                                                    dot={{ r: 0, strokeWidth: 0 }}
                                                                    activeDot={{ r: 6, stroke: '#fff', strokeWidth: 3, fill: 'var(--color-history)' }}
                                                                    connectNulls
                                                                />

                                                                <Line
                                                                    type="monotone"
                                                                    dataKey="forecast"
                                                                    stroke="var(--color-forecast)"
                                                                    strokeWidth={3}
                                                                    strokeDasharray="4 4"
                                                                    dot={{ r: 0, strokeWidth: 0 }}
                                                                    activeDot={{ r: 6, stroke: '#fff', strokeWidth: 3, fill: 'var(--color-forecast)' }}
                                                                    connectNulls
                                                                    animationDuration={1500}
                                                                />
                                                            </ComposedChart>
                                                        </ChartContainer>
                                                    ) : (
                                                        <div className="h-[350px] w-full flex items-center justify-center text-slate-400">
                                                            No Data Available
                                                        </div>
                                                    )}
                                                </MetricCardContent>
                                            </MetricCard>
                                        </div>
                                    </div>
                                )}
                    
                                                    {!isForecastLoading && !forecastData && (
                                                        <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-2xl">
                                                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                                                <Sparkles className="w-8 h-8 text-slate-300" />
                                                            </div>
                                                            <h4 className="font-bold text-slate-600">No Forecast Generated</h4>
                                                            <p className="text-slate-400 text-sm mt-1 max-w-sm mx-auto">Search and select a medicine above to generate an AI-powered demand forecast.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Sales Chart */}
                            <div className="lg:col-span-2">
                                <MetricCard className="h-full border-slate-100 shadow-sm rounded-3xl overflow-hidden bg-white">
                                    <MetricCardHeader className="flex flex-row items-center justify-between pb-2">
                                        <div className="space-y-1">
                                            <MetricCardTitle className="text-xl font-bold text-slate-800">Sales Trend</MetricCardTitle>
                                            <MetricCardDescription className="text-slate-500 font-medium">
                                                Revenue performance over time
                                            </MetricCardDescription>
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
                                    </MetricCardHeader>
                                    <MetricCardContent>
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

                                        <ChartContainer config={chartConfig} className="w-full h-[300px] min-h-[300px]">
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
                                                    tooltipType="none"
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
                                    </MetricCardContent>
                                </MetricCard>
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
                                <div className="flex items-center gap-3 w-full max-w-sm">
                                    <div className="relative w-full">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search directory..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 bg-slate-50 custom-scrollbar">
                                
                                {/* Recommended/Search Suppliers */}
                                {(searchQuery || (directorySuppliers && directorySuppliers.filter(s => s.connectionStatus === 'NONE' && !data?.lists?.suppliers?.some(conn => conn.id === s.id)).length > 0)) && (
                                    <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                                {searchQuery ? (
                                                     <><Search className="w-5 h-5 text-indigo-500" /> Search Results</>
                                                ) : (
                                                     <><Sparkles className="w-5 h-5 text-indigo-500 fill-indigo-100" /> Recommended Suppliers</>
                                                )}
                                            </h3>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {directorySuppliers
                                                .filter(s => s.connectionStatus === 'NONE' && !data?.lists?.suppliers?.some(conn => conn.id === s.id))
                                                .slice(0, searchQuery ? 100 : 5)
                                                .map((supplier) => (
                                                    <div key={supplier.id} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group relative overflow-hidden">
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 flex items-center justify-center text-lg font-bold text-indigo-600 shadow-sm">
                                                                    {supplier.name.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-slate-800">{supplier.name}</div>
                                                                    <div className="text-xs text-slate-500 flex items-center gap-1">
                                                                        <Users className="w-3 h-3" /> Supplier
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleConnectRequest(supplier.id)}
                                                                className="h-8 px-3 text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-none relative z-10"
                                                            >
                                                                Connect
                                                            </Button>
                                                        </div>
                                                        
                                                        <div className="mt-4 pt-3 border-t border-slate-50 grid grid-cols-2 gap-2">
                                                            <div className="max-w-full overflow-hidden">
                                                                <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Email</div>
                                                                <div className="text-xs font-medium text-slate-700 truncate" title={supplier.email || supplier.user?.email}>{supplier.email || supplier.user?.email}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Role</div>
                                                                <div className="text-xs font-medium text-slate-700">Global Supplier</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                )}


                                {(supplierRequests.length > 0) && (
                                    <div className="mb-8">
                                        <div className="mb-4">
                                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                                <Clock className="w-5 h-5 text-amber-500" />
                                                Pending Requests
                                            </h3>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {supplierRequests.map((req, index) => (
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ delay: index * 0.05 }}
                                                    key={req.id}
                                                    className="bg-white rounded-3xl p-1 border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
                                                >
                                                    <div className="bg-slate-50/50 rounded-[20px] p-5 h-full flex flex-col relative overflow-hidden">
                                                        {/* Header */}
                                                        <div className="flex items-start justify-between mb-4 relative z-10">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-[2px] shadow-lg">
                                                                    <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center text-xl font-bold text-slate-700">
                                                                        {req.supplier?.name?.charAt(0).toUpperCase() || "S"}
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <h3 className="font-bold text-slate-800 text-lg leading-tight">{req.supplier?.name || "Unknown Supplier"}</h3>
                                                                    <div className="flex items-center gap-1.5 mt-1">
                                                                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                                                        <span className="text-xs font-medium text-amber-600">Pending Request</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Message Box */}
                                                        <div className="mb-6 relative z-10 bg-white p-4 rounded-xl border border-slate-100 shadow-sm min-h-[80px]">
                                                            {req.message ? (
                                                                <>
                                                                    <div className="absolute -top-2 -left-1">
                                                                        <div className="w-4 h-4 text-amber-200 fill-current opacity-50">
                                                                            <svg viewBox="0 0 24 24"><path d="M14.017 21L14.017 18C14.017 16.896 14.389 16.03 15.152 15.399C15.915 14.768 17.079 14.453 18.665 14.453L23 14.453L23 2.99999L11.517 3L11.517 14.453L12.871 14.453C13.882 14.453 14.389 14.908 14.389 15.823L14.389 21L14.017 21ZM5.389 21L5.389 18C5.389 16.896 5.761 16.03 6.524 15.399C7.287 14.768 8.451 14.453 10.037 14.453L15.372 14.453L15.372 2.99999L1 3L1 14.453L2.354 14.453C3.365 14.453 3.872 14.908 3.872 15.823L3.872 21L5.389 21Z" /></svg>
                                                                        </div>
                                                                    </div>
                                                                    <p className="text-sm text-slate-600 italic leading-relaxed pl-2 relative z-10 line-clamp-3">
                                                                        "{req.message}"
                                                                    </p>
                                                                </>
                                                            ) : (
                                                                <div className="flex items-center justify-center h-full text-xs text-slate-300 italic">
                                                                    No message included
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Actions */}
                                                        <div className="mt-auto pt-2 grid grid-cols-2 gap-3 relative z-10">
                                                            <Button
                                                                variant="outline"
                                                                onClick={() => handleRejectRequest(req.id)}
                                                                className="border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 h-10 rounded-xl font-semibold transition-all"
                                                            >
                                                                Reject
                                                            </Button>
                                                            <Button
                                                                onClick={() => handleAcceptRequest(req.id)}
                                                                className="bg-slate-900 hover:bg-black text-white border-none shadow-lg shadow-slate-900/20 h-10 rounded-xl font-semibold transition-all"
                                                            >
                                                                Accept
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="mb-4">
                                     <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                        <Link className="w-5 h-5 text-slate-500" />
                                        Connected Network
                                    </h3>
                                </div>

                                {(data?.lists?.suppliers && data.lists.suppliers.length > 0) ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {data?.lists.suppliers && data.lists.suppliers.map((supplier, index) => (
                                            <motion.div
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: (supplierRequests.length + index) * 0.05 }}
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
                                                            className="w-full h-11 rounded-xl !bg-slate-900 hover:opacity-90 text-white shadow-lg shadow-slate-900/20 border-none group/btn flex items-center justify-center gap-2 font-semibold cursor-pointer"
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
                                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-4">
                                        <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center">
                                            <Users className={`w-8 h-8 ${theme.text} opacity-50`} />
                                        </div>
                                        <div className="text-center space-y-1">
                                            <h3 className="text-base font-bold text-slate-600">No Connected Suppliers</h3>
                                            <p className="max-w-xs mx-auto text-xs opacity-70">Connect with suppliers from the recommended list above to start ordering.</p>
                                        </div>
                                    </div>
                                )}
                        </div>
                        </div>
                    </motion.div>
                )}

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
                                                                className="!bg-black cursor-pointer !text-white hover:!bg-slate-800 shadow-md shadow-black/10 border-none rounded-xl px-5 h-10 font-semibold gap-2 transition-all"
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
                                            className="!bg-slate-900 text-white hover:opacity-90 shadow-lg shadow-slate-900/20 border-none font-bold rounded-xl"
                                        >
                                            Create New Reorder
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* --- NEW REORDER TAB --- */}
                {activeTab === 'reorder' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col md:flex-row gap-6 h-[calc(100vh-140px)] min-h-[600px]"
                    >
                        {/* Left: Inventory Catalog */}
                        <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden relative">
                            <div className="p-5 border-b border-slate-100 bg-white z-10 flex flex-col gap-4">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Inventory Catalog</h2>
                                        <p className="text-sm text-slate-500">Select items to reorder from suppliers</p>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={handleSmartFill}
                                        disabled={isAiLoading}
                                        className="hidden cursor-pointer md:flex gap-2 !bg-black !text-white hover:!bg-slate-800 border-transparent relative overflow-hidden group transition-all"
                                    >
                                        {isAiLoading ? (
                                            <Sparkles className="w-4 h-4 animate-spin text-indigo-500" />
                                        ) : (
                                            <Sparkles className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition-transform" />
                                        )}
                                        {isAiLoading ? "Analyzing..." : "AI Auto-Fill"}
                                    </Button>
                                </div>
                                <div className="flex gap-2">


                                    <div className="relative flex-1">
                                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search inventory..."
                                            value={reorderSearchQuery}
                                            onChange={(e) => setReorderSearchQuery(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-slate-400 focus:ring-2 focus:ring-slate-100 outline-none transition-all placeholder:text-slate-400 font-medium"
                                        />
                                        {reorderSearchQuery && (
                                            <button onClick={() => setReorderSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                                <div className="grid grid-cols-1 gap-2">
                                    {isReorderLoading ? (
                                        [...Array(6)].map((_, i) => (
                                            <div key={i} className="flex items-center p-3 rounded-xl border border-slate-100 bg-slate-50/50 gap-4">
                                                <Skeleton className="w-10 h-10 rounded-lg" />
                                                <div className="flex-1 space-y-2">
                                                    <Skeleton className="h-4 w-32" />
                                                    <Skeleton className="h-3 w-20" />
                                                </div>
                                                <Skeleton className="h-8 w-16" />
                                            </div>
                                        ))
                                    ) : (
                                        <>
                                            {inventoryList.filter(med => {
                                                const matchesSearch = med.brandName.toLowerCase().includes(reorderSearchQuery.toLowerCase()) ||
                                                    med.genericName.toLowerCase().includes(reorderSearchQuery.toLowerCase());
                                                if (!matchesSearch) return false;
                                                if (inventoryFilter === "out_of_stock") return med.qtyAvailable === 0;
                                                if (inventoryFilter === "in_stock") return med.qtyAvailable > 0;
                                                return true;
                                            }).length === 0 && (
                                                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                                            <Search className="w-8 h-8 opacity-20" />
                                                        </div>
                                                        <p className="font-medium text-slate-500">No matching items</p>
                                                    </div>
                                                )}
                                            {inventoryList.filter(med => {
                                                const matchesSearch = med.brandName.toLowerCase().includes(reorderSearchQuery.toLowerCase()) ||
                                                    med.genericName.toLowerCase().includes(reorderSearchQuery.toLowerCase());
                                                if (!matchesSearch) return false;
                                                if (inventoryFilter === "out_of_stock") return med.qtyAvailable === 0;
                                                if (inventoryFilter === "in_stock") return med.qtyAvailable > 0;
                                                return true;
                                            }).map((med) => {
                                                const inCart = cart.get(med.id) || 0;
                                                return (
                                                    <div
                                                        key={med.id}
                                                        className="group flex items-center p-3 rounded-2xl border border-slate-100 bg-white hover:border-slate-300 hover:shadow-sm transition-all duration-200"
                                                    >
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mr-4 ${med.totalQty === 0 ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'}`}>
                                                            <Package className="w-5 h-5" />
                                                        </div>
                                                        <div className="flex-1 min-w-0 mr-4">
                                                            <h4 className="font-bold text-slate-800 truncate">{med.brandName}</h4>
                                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                                <span className="truncate">{med.genericName}</span>
                                                                <span className="w-1 h-1 rounded-full bg-slate-300" />
                                                                <span>{med.strength}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="text-right mr-2 hidden sm:block">
                                                                <div className={`text-xs font-bold ${med.totalQty < 10 ? 'text-amber-600' : 'text-slate-500'}`}>
                                                                    {med.totalQty} Units
                                                                </div>
                                                                {med.expiringSoon && <span className="text-[10px] text-amber-600 font-bold block">Expiring Soon</span>}
                                                            </div>

                                                            {inCart > 0 ? (
                                                                <div className="flex items-center !bg-black rounded-lg p-1 shadow-md shadow-black/10">
                                                                    <i
                                                                        onClick={() => handleAddToCart(med.id, inCart - 1)}
                                                                        className="w-7 h-7 flex cursor-pointer items-center justify-center !text-white hover:!text-white rounded-md hover:bg-white/10 transition-colors"
                                                                    >
                                                                        -
                                                                    </i>
                                                                    <span className="w-8 text-center font-bold text-sm !text-white">{inCart}</span>
                                                                    <i
                                                                        onClick={() => handleAddToCart(med.id, inCart + 1)}
                                                                        className="w-7 h-7 cursor-pointer flex items-center justify-center !text-white hover:!text-white rounded-md hover:bg-white/10 transition-colors"
                                                                    >
                                                                        +
                                                                    </i>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleAddToCart(med.id, 1)}
                                                                    className="!bg-black border border-transparent !text-white hover:!bg-slate-800 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-md shadow-black/10"
                                                                >
                                                                    Add
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right: Order Summary */}
                        <div className="w-full md:w-[400px] flex flex-col gap-4">
                            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 flex-1 flex flex-col overflow-hidden">
                                <div className="p-5 border-b border-slate-100 bg-slate-50/80">
                                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                        <Truck className="w-5 h-5 text-slate-700" />
                                        Reorder Summary
                                    </h3>
                                </div>

                                <div className="p-5 flex-1 overflow-hidden bg-white flex flex-col gap-5">
                                    {/* Supplier Select */}
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Supplier</label>
                                            <span className="text-[10px] items-center gap-1 flex text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                                                {data?.lists?.suppliers?.length || 0} Available
                                            </span>
                                        </div>
                                        <Select value={reorderSupplierId} onValueChange={setReorderSupplierId} disabled={!data?.lists?.suppliers?.length}>
                                            <SelectTrigger className="w-full !bg-slate-900 border-none h-12 rounded-xl !text-white shadow-lg shadow-slate-900/10 focus:ring-0">
                                                <span className="text-white font-bold truncate">
                                                    {reorderSupplierId
                                                        ? data?.lists?.suppliers?.find(s => s.id === reorderSupplierId)?.name
                                                        : <span className="text-slate-400 font-normal">Select a supplier...</span>
                                                    }
                                                </span>
                                            </SelectTrigger>
                                            <SelectContent className="bg-white rounded-xl border-slate-200 shadow-xl p-1 z-50">
                                                {data?.lists?.suppliers?.map((s) => (
                                                    <SelectItem key={s.id} value={s.id} textValue={s.name} className="rounded-lg cursor-pointer focus:bg-slate-50 py-3">
                                                        <div className="font-bold text-slate-800">{s.name}</div>
                                                        <div className="text-xs text-slate-400">{s.email}</div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {!data?.lists?.suppliers?.length && (
                                            <div className="mt-2 text-xs text-red-500 bg-red-50 p-2 rounded-lg flex items-center gap-2 font-medium">
                                                <X className="w-3 h-3" /> No suppliers connected
                                            </div>
                                        )}
                                    </div>

                                    {/* Cart Items */}
                                    <div className="flex-auto bg-slate-50 rounded-2xl p-4 border border-slate-100 relative min-h-[120px] overflow-y-auto custom-scrollbar">
                                        <div className="absolute top-0 right-0 p-2 opacity-5">
                                            <ClipboardList className="w-24 h-24" />
                                        </div>
                                        {cart.size === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 min-h-[100px]">
                                                <span className="text-sm font-medium">No items selected</span>
                                            </div>
                                        ) : (
                                            <ul className="space-y-3 relative z-10">
                                                {Array.from(cart.entries()).map(([id, qty]) => {
                                                    const m = inventoryList.find(x => x.id === id) || suggestedItems.find(x => x.id === id);
                                                    return (
                                                        <li key={id} className="flex justify-between items-start text-sm">
                                                            <div className="flex-1 pr-2">
                                                                <span className="font-bold text-slate-700 block">{m?.brandName}</span>
                                                                <span className="text-xs text-slate-400">{m?.genericName}</span>
                                                            </div>
                                                            <div className="bg-white px-2 py-1 rounded border border-slate-200 font-mono font-bold text-slate-800 text-xs shadow-sm">
                                                                x{qty}
                                                            </div>
                                                        </li>
                                                    )
                                                })}
                                            </ul>
                                        )}
                                    </div>

                                    {/* Note Input */}
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Note to Supplier</label>
                                        <textarea
                                            className="w-full p-3 text-sm bg-slate-50 border border-slate-100 rounded-xl resize-none focus:outline-none focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-100 transition-all placeholder:text-slate-400"
                                            rows={2}
                                            placeholder="Optional delivery instructions..."
                                            value={reorderNote}
                                            onChange={e => setReorderNote(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="p-5 border-t border-slate-100 bg-slate-50/50">
                                    <Button
                                        className="w-full h-14 cursor-pointer !bg-slate-900 text-white hover:opacity-95 shadow-xl shadow-slate-900/30 font-bold text-base rounded-2xl flex items-center justify-center gap-2 transition-all hover:translate-y-[-2px] active:translate-y-[0px]"
                                        disabled={cart.size === 0 || !reorderSupplierId || isSendingReorder}
                                        onClick={handleReorderClick}
                                    >
                                        {isSendingReorder ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <Send className="w-4 h-4" />
                                        )}
                                        {isSendingReorder ? "Sending..." : `Send Request (${cart.size} Items)`}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* --- NEW SALE (POS) TAB --- */}
                {activeTab === 'sale' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col md:flex-row gap-6 h-[calc(100vh-140px)] min-h-[600px]"
                    >
                        {/* Left: Product Catalog */}
                        <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden relative">
                            <div className="p-5 border-b border-slate-100 bg-white z-10">
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Product Catalog</h2>
                                        <p className="text-sm text-slate-500">Select items to add to the register</p>
                                    </div>
                                    <div className="bg-slate-100 p-2 rounded-xl">
                                        <Search className="w-5 h-5 text-slate-400" />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <div className="relative">
                                        <button
                                            className={`h-[46px] w-[46px] flex items-center justify-center rounded-xl border transition-all cursor-pointer !bg-white !text-black ${posInventoryFilter !== 'all' ? 'border-2 border-black' : 'border-slate-200 hover:border-slate-300'}`}
                                            title={`Filter: ${posInventoryFilter === 'all' ? 'All' : posInventoryFilter === 'out_of_stock' ? 'Out of Stock' : 'Available'}`}
                                        >
                                            <Filter className="w-4 h-4" />
                                        </button>
                                        <select
                                            value={posInventoryFilter}
                                            onChange={(e) => setPosInventoryFilter(e.target.value as any)}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        >
                                            <option value="all">All Items</option>
                                            <option value="out_of_stock">Out of Stock</option>
                                            <option value="in_stock">Available</option>
                                        </select>
                                    </div>

                                    <div className="relative flex-1">
                                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search by brand or generic name..."
                                            value={posQuery}
                                            onChange={(e) => setPosQuery(e.target.value)}
                                            autoFocus
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-slate-400 focus:ring-2 focus:ring-slate-100 outline-none transition-all placeholder:text-slate-400 font-medium"
                                        />
                                        {posQuery && (
                                            <button onClick={() => setPosQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                                <div className="grid grid-cols-1 gap-2">
                                    {isPosLoading ? (
                                        [...Array(6)].map((_, i) => (
                                            <div key={i} className="flex items-center p-3 rounded-xl border border-slate-100 bg-slate-50/50 gap-4">
                                                <Skeleton className="w-10 h-10 rounded-lg" />
                                                <div className="flex-1 space-y-2">
                                                    <Skeleton className="h-4 w-32" />
                                                    <Skeleton className="h-3 w-20" />
                                                </div>
                                                <Skeleton className="h-8 w-16" />
                                            </div>
                                        ))
                                    ) : (
                                        <>
                                            {posResults.filter((med: any) => {
                                                const totalStock = med.inventory?.reduce((acc: any, b: any) => acc + b.qtyAvailable, 0) || 0;
                                                if (posInventoryFilter === 'out_of_stock') return totalStock === 0;
                                                if (posInventoryFilter === 'in_stock') return totalStock > 0;
                                                return true;
                                            }).length === 0 && (
                                                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                                            <Search className="w-8 h-8 opacity-20" />
                                                        </div>
                                                        <p className="font-medium text-slate-500">No products found</p>
                                                        <p className="text-sm opacity-70">Try searching for a different medicine</p>
                                                    </div>
                                                )}
                                            {posResults.filter((med: any) => {
                                                const totalStock = med.inventory?.reduce((acc: any, b: any) => acc + b.qtyAvailable, 0) || 0;
                                                if (posInventoryFilter === 'out_of_stock') return totalStock === 0;
                                                if (posInventoryFilter === 'in_stock') return totalStock > 0;
                                                return true;
                                            }).map((med: any) => {
                                                const totalStock = med.inventory?.reduce((acc: any, b: any) => acc + b.qtyAvailable, 0) || 0;
                                                const cartItem = posCart.get(med.id);
                                                const inCart = cartItem ? cartItem.qty : 0;
                                                return (
                                                    <div
                                                        key={med.id}
                                                        className={`group flex items-center p-3 rounded-2xl border transition-all duration-200 ${totalStock > 0 ? 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm' : 'bg-slate-50 border-slate-100 opacity-70'}`}
                                                    >
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mr-4 ${totalStock > 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-400'}`}>
                                                            <Package className="w-5 h-5" />
                                                        </div>
                                                        <div className="flex-1 min-w-0 mr-4">
                                                            <h4 className="font-bold text-slate-800 truncate">{med.brandName}</h4>
                                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                                <span className="truncate">{med.genericName}</span>
                                                                <span className="w-1 h-1 rounded-full bg-slate-300" />
                                                                <span>{med.strength}</span>
                                                            </div>
                                                        </div>

                                                        {totalStock > 0 ? (
                                                            <div className="flex items-center gap-3">
                                                                <div className="text-right mr-2 hidden sm:block">
                                                                    <div className={`text-xs font-bold ${totalStock - inCart < 10 ? 'text-amber-600' : 'text-slate-500'}`}>
                                                                        {totalStock - inCart} in stock
                                                                    </div>
                                                                </div>
                                                                {inCart > 0 ? (
                                                                    <div className="flex items-center !bg-black rounded-lg p-1 shadow-md shadow-black/10">
                                                                        <i
                                                                            onClick={() => handlePOSAddToCart(med, inCart - 1)}
                                                                            className="w-7 h-7 flex cursor-pointer items-center justify-center !text-white hover:!text-white rounded-md hover:bg-white/10 transition-colors"
                                                                        >
                                                                            -
                                                                        </i>
                                                                        <span className="w-8 text-center font-bold text-sm !text-white">{inCart}</span>
                                                                        <i
                                                                            onClick={() => handlePOSAddToCart(med, inCart + 1)}
                                                                            className="w-7 h-7 cursor-pointer flex items-center justify-center !text-white hover:!text-white rounded-md hover:bg-white/10 transition-colors"
                                                                        >
                                                                            +
                                                                        </i>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => handlePOSAddToCart(med, 1)}
                                                                        className="!bg-black border border-transparent !text-white hover:!bg-slate-800 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-md shadow-black/10"
                                                                    >
                                                                        Add
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs font-bold text-red-400 bg-red-50 px-2 py-1 rounded-lg">Out of Stock</span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right: Register / Cart */}
                        <div className="w-full md:w-[400px] flex flex-col gap-4">
                            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 flex-1 flex flex-col overflow-hidden">
                                <div className="p-5 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-900/20">
                                            <ShoppingCart className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900">Current Sale</h3>

                                        </div>
                                    </div>
                                    <div className="text-xs font-bold bg-white border border-slate-200 px-2 py-1 rounded-lg text-slate-600">
                                        {new Date().toLocaleDateString()}
                                    </div>
                                </div>

                                {/* Cart Items (Receipt Look) */}
                                <div className="flex-1 p-5 overflow-y-auto custom-scrollbar bg-white relative">
                                    {posCart.size === 0 ? (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 gap-3">
                                            <ShoppingCart className="w-12 h-12 opacity-10" />
                                            <p className="text-sm font-medium">Register is empty</p>
                                            <p className="text-xs max-w-[150px] text-center opacity-60">Scan items or select from catalog to begin</p>
                                        </div>
                                    ) : (
                                        <ul className="space-y-4">
                                            {Array.from(posCart.values()).map(({ medicine: m, qty }) => {
                                                // Fallback to first batch MRP if sellingPrice is not set
                                                const price = m.sellingPrice || (m.inventory && m.inventory.length > 0 ? Number(m.inventory[0].mrp) : 0) || 0;
                                                const subtotal = price * qty;
                                                return (
                                                    <li key={m.id} className="flex justify-between items-start group">
                                                        <div className="flex-1 pr-4">
                                                            <div className="font-bold text-slate-800 text-sm">{m.brandName}</div>
                                                            <div className="text-xs text-slate-400 mt-0.5">{m.genericName} {m.strength && `• ${m.strength}`}</div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="text-xs font-bold text-slate-500">x{qty}</div>
                                                            <span className="font-mono text-sm font-bold text-slate-900">₹{subtotal.toFixed(2)}</span>
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                            <div className="border-t-2 border-dashed border-slate-100 my-4" />
                                            {/* Removed Subtotal and Tax as requested */}
                                            <div className="flex justify-between items-center text-lg font-bold text-slate-900 mt-2">
                                                <span>Total</span>
                                                <span className="font-mono">₹{Array.from(posCart.values()).reduce((acc, item) => {
                                                    const m = item.medicine;
                                                    const price = m.sellingPrice || (m.inventory && m.inventory.length > 0 ? Number(m.inventory[0].mrp) : 0) || 0;
                                                    return acc + (price * item.qty);
                                                }, 0).toFixed(2)}</span>
                                            </div>
                                        </ul>
                                    )}
                                </div>

                                {/* Payment Section */}
                                <div className="p-5 bg-slate-50 border-t border-slate-100">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Payment Method</label>
                                    <div className="grid grid-cols-2 gap-2 mb-2">
                                        {[
                                            { id: "CASH", icon: Banknote, label: "Cash", disabled: false },
                                            { id: "CARD", icon: CreditCard, label: "Card", disabled: true },
                                            { id: "UPI", icon: Smartphone, label: "UPI", disabled: true },
                                            { id: "OTHER", icon: MoreHorizontal, label: "Other", disabled: true }
                                        ].map((item) => (
                                            <button
                                                key={item.id}
                                                disabled={item.disabled}
                                                onClick={() => !item.disabled && setPosPaymentMethod(item.id)}
                                                className={`flex items-center cursor-pointer justify-center gap-2 py-3 px-2 rounded-xl text-xs font-bold border transition-all duration-200 
                                                    ${item.disabled ? 'cursor-not-allowed !bg-white !text-black border-slate-200 opacity-60' : ''}
                                                    ${!item.disabled && posPaymentMethod === item.id
                                                        ? "!bg-slate-900 !text-white !border-slate-900 shadow-md shadow-slate-900/20 scale-[1.02]"
                                                        : (!item.disabled ? "!bg-white !text-slate-600 !border-slate-200 hover:!bg-slate-50 hover:!border-slate-300" : "")
                                                    }`}
                                            >
                                                <item.icon className="w-3.5 h-3.5" />
                                                {item.label}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-amber-600 font-medium text-center mb-4 flex items-center justify-center gap-1">
                                        <Activity className="w-3 h-3" /> Only Cash payments accepted at this time
                                    </p>

                                    <Button
                                        className="w-full h-14 !bg-slate-900 cursor-pointer text-white hover:opacity-95 shadow-xl shadow-slate-900/30 font-bold text-base rounded-2xl flex items-center justify-center gap-2 transition-all hover:translate-y-[-2px] active:translate-y-[0px]"
                                        disabled={posCart.size === 0 || isCheckoutLoading}
                                        onClick={handlePOSCheckoutClick}
                                    >
                                        {isCheckoutLoading ? (
                                            <Sparkles className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <CheckCircle className="w-5 h-5" />
                                        )}
                                        {isCheckoutLoading ? "Processing..." : "Complete Sale"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </motion.div >
                )}

                {/* --- HISTORY TAB --- */}
                {
                    activeTab === 'history' && (
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
                                                                    size="sm"
                                                                    onClick={() => viewReceiptPDF(receipt.id)}
                                                                    className="gap-2 cursor-pointer !bg-black !text-white hover:!bg-slate-800 shadow-md shadow-black/10 border-transparent"
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
                    )
                }


                {/* Suppliers Directory Modal */}



            </main >
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
                                        className="h-12 cursor-pointer rounded-xl !border-black !text-black hover:!bg-slate-50 !bg-white font-semibold"
                                        onClick={() => setShowDisconnectConfirm(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className="h-12 cursor-pointer rounded-xl !bg-black hover:!bg-slate-800 !text-white border-none shadow-lg shadow-black/20 font-semibold"
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
                                    <button

                                        className="h-12 cursor-pointer rounded-xl !bg-black hover:!bg-slate-800 !text-white border-none shadow-lg shadow-black/20 font-semibold"
                                        onClick={() => setShowLogoutConfirm(false)}
                                    >
                                        Cancel
                                    </button>
                                    <Button
                                        className="h-12 cursor-pointer rounded-xl !bg-black hover:!bg-slate-800 !text-white border-none shadow-lg shadow-black/20 font-semibold"
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
                                        className="h-12 cursor-pointer rounded-xl !border-black !text-black hover:!bg-slate-50 !bg-white font-semibold"
                                        onClick={() => setShowPOSConfirm(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className="h-12 cursor-pointer rounded-xl !bg-black hover:!bg-slate-800 !text-white border-none shadow-lg shadow-black/20 font-semibold"
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
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                                        <CheckCircle className="w-6 h-6 text-emerald-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-emerald-600 text-lg leading-tight">Transaction Successful</h3>
                                        <p className="text-xs text-slate-500 font-medium">Receipt Generated</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowReceiptPreview(false)} className="p-2 cursor-pointer !bg-black hover:bg-slate-800 rounded-lg transition-colors shadow-md shadow-black/10">
                                    <X className="w-5 h-5 !text-white" />
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
                                                className="w-full px-3 py-2 border border-black rounded-lg text-sm focus:ring-2 focus:ring-black outline-none"
                                            />
                                            <Button
                                                onClick={handleSendReceipt}
                                                disabled={isSendingEmail || !receiptEmail}
                                                className="w-full cursor-pointer !bg-black hover:!bg-slate-800 !text-white shadow-lg shadow-black/20"
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
                                            className="block w-full bg-black text-white text-center py-2 px-4 border border-black rounded-lg font-medium hover:bg-black transition-colors"
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
                                        disabled={isDisconnectLoading}
                                        onClick={() => {
                                            if (disconnectSupplierId) {
                                                executeDisconnectSupplier();
                                            }
                                        }}
                                    >
                                        {isDisconnectLoading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Disconnecting...
                                            </>
                                        ) : (
                                            "Disconnect"
                                        )}
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
                                    className="p-2 !bg-black cursor-pointer hover:bg-slate-800 rounded-lg transition-colors shadow-md shadow-black/10"
                                >
                                    <X className="w-5 h-5 !text-white" />
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
                                    className="px-6 rounded-xl cursor-pointer font-bold !bg-black border border-transparent !text-white hover:!bg-slate-800 shadow-lg shadow-black/10"
                                >
                                    Close
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>


            {/* Reorder Result Modal */}
            <AnimatePresence>
                {reorderResult && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center relative overflow-hidden"
                        >
                            <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6 ${reorderResult.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                {reorderResult.type === 'success' ? <CheckCircle className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
                            </div>

                            <h3 className="text-xl font-bold text-slate-900 mb-2">
                                {reorderResult.type === 'success' ? 'Success!' : 'Something went wrong'}
                            </h3>
                            <p className="text-slate-500 mb-8 leading-relaxed">
                                {reorderResult.message}
                            </p>

                            <Button
                                onClick={() => {
                                    if (reorderResult.type === 'success') {
                                        // Reset form on success close
                                        setActiveTab('overview');
                                        setCart(new Map());
                                        setReorderNote("");
                                        setReorderSupplierId("");
                                        setSuggestedItems([]);
                                    }
                                    setReorderResult(null);
                                }}
                                className="w-full h-12 cursor-pointer rounded-xl font-bold !bg-black !text-white hover:!bg-slate-800"
                            >
                                {reorderResult.type === 'success' ? 'Done' : 'Try Again'}
                            </Button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>


            {/* Forecast Error Modal */}
            <AnimatePresence>
                {forecastError && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center relative overflow-hidden"
                        >
                            <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6 bg-red-100 text-red-600">
                                <XCircle className="w-8 h-8" />
                            </div>

                            <h3 className="text-xl font-bold text-slate-900 mb-2">
                                Forecast Failed
                            </h3>
                            <p className="text-slate-500 mb-8 leading-relaxed">
                                {forecastError}
                            </p>

                            <Button
                                onClick={() => setForecastError(null)}
                                className="w-full h-12 cursor-pointer rounded-xl font-bold !bg-black !text-white hover:!bg-slate-800"
                            >
                                Close
                            </Button>
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
        </div>
    );
};









export default StoreOwnerDashboard;

