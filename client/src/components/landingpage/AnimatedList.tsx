import React, { useState, useEffect } from "react";
import {
  Package,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Clock,
  ShoppingCart,
  Bell,
  Zap,
  Upload,
  FileSpreadsheet,
  Receipt,
  Check,
  Download,
} from "lucide-react";

const cn = (...classes: any[]) => classes.filter(Boolean).join(" ");

// Notification Data
const notifications = [
  {
    name: "Low Stock Alert",
    description: "Paracetamol 500mg - Only 12 units remaining",
    time: "2m ago",
    icon: AlertTriangle,
    color: "#EF4444",
    badge: "Urgent",
  },
  {
    name: "Expiry Warning",
    description: "Amoxicillin capsules expiring in 15 days",
    time: "5m ago",
    icon: Clock,
    color: "#F59E0B",
    badge: "Action Required",
  },
  {
    name: "Order Received",
    description: "New shipment of 150 items processed",
    time: "8m ago",
    icon: Package,
    color: "#10B981",
    badge: "Success",
  },
  {
    name: "Sales Transaction",
    description: "₹2,450 sale completed - 8 items sold",
    time: "12m ago",
    icon: ShoppingCart,
    color: "#3B82F6",
    badge: "Completed",
  },
  {
    name: "Auto-Reorder Triggered",
    description: "Metformin tablets reordered automatically",
    time: "15m ago",
    icon: Zap,
    color: "#8B5CF6",
    badge: "Automated",
  },
  {
    name: "Inventory Updated",
    description: "Stock levels synced across 3 locations",
    time: "18m ago",
    icon: CheckCircle2,
    color: "#06B6D4",
    badge: "Synced",
  },
];

// Excel Upload Animation Component
const ExcelUploadAnimation = () => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { label: "Uploading file", icon: Upload },
    { label: "Parsing data", icon: FileSpreadsheet },
    { label: "Validating entries", icon: CheckCircle2 },
    { label: "Syncing inventory", icon: Package },
  ];

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          return 0;
        }
        return prev + 2;
      });
    }, 50);

    return () => clearInterval(progressInterval);
  }, []);

  useEffect(() => {
    setCurrentStep(Math.floor((uploadProgress / 100) * steps.length));
  }, [uploadProgress]);

  return (
    <div className="space-y-6">
      {/* Upload Card */}
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-emerald-600 rounded-2xl opacity-75 group-hover:opacity-100 blur transition duration-500"></div>
        <div className="relative bg-white/90 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shadow-lg">
                <FileSpreadsheet className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Inventory_Data.xlsx
                </h3>
                <p className="text-xs text-gray-500">2.4 MB • 1,250 items</p>
              </div>
            </div>
            <Upload className="w-5 h-5 text-blue-600 animate-bounce" />
          </div>

          {/* Progress Bar */}
          <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-600 to-emerald-600 transition-all duration-300 rounded-full"
              style={{ width: `${uploadProgress}%` }}
            >
              <div className="absolute inset-0 bg-white/30 animate-shimmer"></div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600 font-medium">
              {uploadProgress}% Complete
            </span>
            <span className="text-blue-600 font-semibold">
              {currentStep + 1}/{steps.length} Steps
            </span>
          </div>
        </div>
      </div>

      {/* Steps Progress */}
      <div className="space-y-3">
        {steps.map((step, idx) => {
          const StepIcon = step.icon;
          const isActive = idx === currentStep;
          const isComplete = idx < currentStep;

          return (
            <div
              key={idx}
              className={cn(
                "relative group transition-all duration-500",
                isActive && "scale-105"
              )}
            >
              <div
                className={cn(
                  "absolute -inset-0.5 rounded-xl opacity-0 blur transition duration-500",
                  isActive &&
                    "opacity-75 bg-gradient-to-r from-blue-400 to-emerald-400"
                )}
              ></div>
              <div
                className={cn(
                  "relative flex items-center gap-3 p-3 rounded-xl border backdrop-blur-sm transition-all duration-500",
                  isComplete && "bg-emerald-50/80 border-emerald-200",
                  isActive && "bg-white/90 border-blue-200 shadow-lg",
                  !isActive && !isComplete && "bg-white/50 border-gray-200"
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500",
                    isComplete && "bg-emerald-500",
                    isActive &&
                      "bg-gradient-to-br from-blue-500 to-emerald-500 animate-pulse",
                    !isActive && !isComplete && "bg-gray-200"
                  )}
                >
                  {isComplete ? (
                    <Check className="w-4 h-4 text-white" />
                  ) : (
                    <StepIcon
                      className={cn(
                        "w-4 h-4",
                        isActive ? "text-white" : "text-gray-400"
                      )}
                    />
                  )}
                </div>
                <span
                  className={cn(
                    "text-sm font-medium transition-colors",
                    isComplete && "text-emerald-700",
                    isActive && "text-gray-900",
                    !isActive && !isComplete && "text-gray-400"
                  )}
                >
                  {step.label}
                </span>
                {isActive && (
                  <div className="ml-auto flex gap-1">
                    <div
                      className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    ></div>
                    <div
                      className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    ></div>
                    <div
                      className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    ></div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Items", value: "1,250", color: "blue" },
          { label: "Categories", value: "48", color: "emerald" },
        ].map((stat, idx) => (
          <div key={idx} className="relative group">
            <div
              className={cn(
                "absolute -inset-0.5 rounded-xl opacity-0 group-hover:opacity-75 blur transition duration-500",
                stat.color === "blue" ? "bg-blue-400" : "bg-emerald-400"
              )}
            ></div>
            <div className="relative bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-white/20 shadow-lg">
              <div className="text-2xl font-black bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
                {stat.value}
              </div>
              <div className="text-xs text-gray-600 font-medium">
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Notification Component
const Notification = ({
  name,
  description,
  icon: Icon,
  color,
  time,
  badge,
  index,
}: {
  name: string;
  description: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  color: string;
  time: string;
  badge?: string;
  index: number;
}) => {
  return (
    <div
      className="relative mx-auto w-full cursor-pointer overflow-hidden rounded-xl p-4 transition-all duration-300 hover:scale-[102%] bg-white/80 backdrop-blur-xl border border-white/20 shadow-lg hover:shadow-2xl group"
      style={{
        animation: `slideIn 0.5s ease-out ${index * 0.1}s both`,
        zIndex: 50 - index,
      }}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
        style={{ backgroundColor: color }}
      />

      <div className="flex items-start gap-3 pl-2">
        <div
          className="flex w-10 h-10 items-center justify-center rounded-xl shrink-0 shadow-md"
          style={{
            backgroundColor: `${color}15`,
            color: color,
          }}
        >
          <Icon className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="text-sm font-bold text-gray-900">{name}</span>
            {badge && (
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                style={{
                  backgroundColor: `${color}15`,
                  color: color,
                }}
              >
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">{description}</p>
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-1 h-1 rounded-full bg-gray-300" />
            <span className="text-xs text-gray-500">{time}</span>
          </div>
        </div>
      </div>

      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity rounded-xl pointer-events-none"
        style={{ backgroundColor: color }}
      />
    </div>
  );
};

// Receipt Generation Component
const ReceiptGeneration = () => {
  const [generationProgress, setGenerationProgress] = useState(0);
  const [showReceipt, setShowReceipt] = useState(false);

  const receiptItems = [
    { name: "Paracetamol 500mg", qty: 2, price: 45 },
    { name: "Amoxicillin Cap", qty: 1, price: 180 },
    { name: "Vitamin D3", qty: 3, price: 240 },
    { name: "Aspirin 75mg", qty: 1, price: 35 },
  ];

  useEffect(() => {
    const progressTimer = setInterval(() => {
      setGenerationProgress((prev) => {
        if (prev >= 100) {
          setShowReceipt(true);
          return 100;
        }
        return prev + 5;
      });
    }, 80);

    return () => clearInterval(progressTimer);
  }, []);

  useEffect(() => {
    if (generationProgress >= 100) {
      const resetTimer = setTimeout(() => {
        setGenerationProgress(0);
        setShowReceipt(false);
      }, 5000);
      return () => clearTimeout(resetTimer);
    }
  }, [generationProgress]);

  const total = receiptItems.reduce(
    (sum, item) => sum + item.qty * item.price,
    0
  );

  return (
    <div className="space-y-6">
      {/* Generation Status */}
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl opacity-75 group-hover:opacity-100 blur transition duration-500"></div>
        <div className="relative bg-white/90 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                <Receipt className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Receipt #INV-2024-0847
                </h3>
                <p className="text-xs text-gray-500">
                  Processing transaction...
                </p>
              </div>
            </div>
            {showReceipt && (
              <Download className="w-5 h-5 text-purple-600 animate-bounce" />
            )}
          </div>

          {/* Progress */}
          {!showReceipt && (
            <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-300 rounded-full"
                style={{ width: `${generationProgress}%` }}
              >
                <div className="absolute inset-0 bg-white/30 animate-shimmer"></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Receipt Preview */}
      <div
        className={cn(
          "relative transition-all duration-700 transform",
          showReceipt ? "opacity-100 scale-100" : "opacity-0 scale-95"
        )}
      >
        <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-400 to-pink-400 rounded-2xl opacity-75 blur"></div>
        <div className="relative bg-white/95 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden">
          {/* Receipt Header */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold">SynapStore Pharmacy</h3>
              <Receipt className="w-6 h-6" />
            </div>
            <p className="text-sm text-purple-100">
              123 Medical Plaza, New Delhi
            </p>
            <p className="text-xs text-purple-200 mt-1">GST: 07AABCU9603R1ZX</p>
          </div>

          {/* Receipt Body */}
          <div className="p-6 space-y-4">
            <div className="flex justify-between text-xs text-gray-600 border-b border-gray-200 pb-2">
              <span>Receipt #INV-2024-0847</span>
              <span>{new Date().toLocaleDateString()}</span>
            </div>

            {/* Items */}
            <div className="space-y-3">
              {receiptItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center text-sm"
                  style={{
                    animation: `fadeInUp 0.4s ease-out ${idx * 0.1}s both`,
                    opacity: showReceipt ? 1 : 0,
                  }}
                >
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">
                      {item.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      Qty: {item.qty} × ₹{item.price}
                    </div>
                  </div>
                  <div className="font-bold text-gray-900">
                    ₹{item.qty * item.price}
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="border-t-2 border-gray-200 pt-4 flex justify-between items-center">
              <span className="text-lg font-bold text-gray-900">
                Total Amount
              </span>
              <span className="text-2xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                ₹{total}
              </span>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span className="text-xs text-emerald-600 font-semibold">
                  Payment Complete
                </span>
              </div>
              <span className="text-xs text-gray-500">Cash</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {[
          {
            label: "Items Sold",
            value: receiptItems.reduce((sum, item) => sum + item.qty, 0),
            icon: ShoppingCart,
          },
          { label: "Revenue", value: `₹${total}`, icon: TrendingUp },
        ].map((stat, idx) => (
          <div key={idx} className="relative group">
            <div className="absolute -inset-0.5 rounded-xl opacity-0 group-hover:opacity-75 bg-gradient-to-r from-purple-400 to-pink-400 blur transition duration-500"></div>
            <div className="relative bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-white/20 shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className="w-4 h-4 text-purple-600" />
                <span className="text-xs text-gray-600 font-medium">
                  {stat.label}
                </span>
              </div>
              <div className="text-xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                {stat.value}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function AnimatedInventoryShowcase() {
  const [visibleNotifications, setVisibleNotifications] = useState<any[]>([]);

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      setVisibleNotifications((prev: any) => {
        const next = [...prev, notifications[index % notifications.length]];
        return next.slice(-5); // Keep only last 5
      });
      index++;
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-screen py-12 sm:py-16 md:py-24 overflow-hidden bg-gradient-to-b from-slate-50 via-white to-blue-50/30">
      <style>{`
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-20px); } }
        .animate-shimmer { animation: shimmer 2s infinite; }
        .animate-float { animation: float 6s ease-in-out infinite; }
        @media (max-width: 640px) {
          .notification-scroll { -webkit-overflow-scrolling: touch; }
        }
      `}</style>

      {/* Background Elements */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-10 sm:top-20 right-10 sm:right-20 w-48 h-48 sm:w-96 sm:h-96 bg-blue-400/10 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-10 sm:bottom-20 left-10 sm:left-20 w-40 h-40 sm:w-80 sm:h-80 bg-purple-400/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 sm:w-96 sm:h-96 bg-emerald-400/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "2s" }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12 lg:mb-16">
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/80 backdrop-blur-xl border border-blue-200/50 shadow-lg mb-3 sm:mb-4 animate-float">
            <Bell className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
            <span className="text-xs sm:text-sm font-semibold text-blue-700">
              Live Activity Feed
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-3 sm:mb-4 px-4">
            Real-time Inventory Intelligence
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed px-4">
            Watch your pharmacy operations come alive with instant uploads,
            smart alerts, and automated receipt generation
          </p>
        </div>

        {/* Three Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Left: Excel Upload */}
          <div className="lg:col-span-1 order-1">
            <ExcelUploadAnimation />
          </div>

          {/* Center: Notifications */}
          <div className="lg:col-span-1 order-3 md:order-2 md:col-span-2 lg:col-span-1">
            <div className="relative h-[500px] sm:h-[600px] lg:h-[700px] rounded-2xl sm:rounded-3xl bg-white/60 backdrop-blur-xl border border-white/20 shadow-2xl overflow-hidden">
              {/* Gradient Overlays */}
              <div className="absolute top-0 inset-x-0 h-16 sm:h-24 bg-gradient-to-b from-white to-transparent z-10 pointer-events-none" />
              <div className="absolute bottom-0 inset-x-0 h-20 sm:h-32 bg-gradient-to-t from-white to-transparent z-10 pointer-events-none" />

              <div className="absolute inset-0 p-4 sm:p-6 pt-12 sm:pt-16 pb-16 sm:pb-20 overflow-y-auto space-y-3 sm:space-y-4 notification-scroll">
                {visibleNotifications.map((notification: any, idx) => (
                  <Notification
                    key={`${notification.name}-${idx}`}
                    {...notification}
                    index={idx}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right: Receipt Generation */}
          <div className="lg:col-span-1 order-2 md:order-3">
            <ReceiptGeneration />
          </div>
        </div>
      </div>
    </section>
  );
}
