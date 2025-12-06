"use client";

import {
  Package,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Clock,
  ShoppingCart,
  Bell,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedList } from "@/components/landingpage/animated-list";

interface Item {
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  time: string;
  badge?: string;
}

let notifications: Item[] = [
  {
    name: "Low Stock Alert",
    description: "Paracetamol 500mg - Only 12 units remaining",
    time: "2m ago",
    icon: <AlertTriangle className="w-5 h-5" />,
    color: "#EF4444",
    badge: "Urgent",
  },
  {
    name: "Expiry Warning",
    description: "Amoxicillin capsules expiring in 15 days",
    time: "5m ago",
    icon: <Clock className="w-5 h-5" />,
    color: "#F59E0B",
    badge: "Action Required",
  },
  {
    name: "Order Received",
    description: "New shipment of 150 items processed",
    time: "8m ago",
    icon: <Package className="w-5 h-5" />,
    color: "#10B981",
    badge: "Success",
  },
  {
    name: "Sales Transaction",
    description: "₹2,450 sale completed - 8 items sold",
    time: "12m ago",
    icon: <ShoppingCart className="w-5 h-5" />,
    color: "#3B82F6",
    badge: "Completed",
  },
  {
    name: "Auto-Reorder Triggered",
    description: "Metformin tablets reordered automatically",
    time: "15m ago",
    icon: <Zap className="w-5 h-5" />,
    color: "#8B5CF6",
    badge: "Automated",
  },
  {
    name: "Inventory Updated",
    description: "Stock levels synced across 3 locations",
    time: "18m ago",
    icon: <CheckCircle2 className="w-5 h-5" />,
    color: "#06B6D4",
    badge: "Synced",
  },
  {
    name: "Fast Moving Item",
    description: "Aspirin 75mg - High sales velocity detected",
    time: "22m ago",
    icon: <TrendingUp className="w-5 h-5" />,
    color: "#EC4899",
    badge: "Trending",
  },
  {
    name: "Smart Alert",
    description: "Reorder point reached for 5 medicines",
    time: "25m ago",
    icon: <Bell className="w-5 h-5" />,
    color: "#F97316",
    badge: "Alert",
  },
];

notifications = Array.from({ length: 12 }, () => notifications).flat();

const Notification = ({
  name,
  description,
  icon,
  color,
  time,
  badge,
}: Item) => {
  return (
    <figure
      className={cn(
        "relative mx-auto min-h-fit w-full max-w-[420px] cursor-pointer overflow-hidden rounded-xl p-5",
        "transition-all duration-300 ease-in-out hover:scale-[102%] hover:shadow-xl",
        "bg-white border border-gray-100",
        "shadow-[0_2px_8px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.06)]",
        "transform-gpu group"
      )}
    >
      {/* Colored accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: color }}
      />

      <div className="flex flex-row items-start gap-4 pl-1">
        {/* Icon container */}
        <div
          className="flex size-11 items-center justify-center rounded-xl shrink-0 shadow-sm"
          style={{
            backgroundColor: `${color}15`,
            color: color,
          }}
        >
          {icon}
        </div>

        {/* Content */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <figcaption className="flex flex-col gap-1 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-semibold text-gray-900 leading-tight">
                  {name}
                </span>
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
              <p className="text-sm font-normal text-gray-600 leading-relaxed">
                {description}
              </p>
            </figcaption>
          </div>

          {/* Time badge */}
          <div className="flex items-center gap-1.5 mt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
            <span className="text-xs text-gray-500 font-medium">{time}</span>
          </div>
        </div>
      </div>

      {/* Hover effect overlay */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity pointer-events-none rounded-xl"
        style={{ backgroundColor: color }}
      />
    </figure>
  );
};

export function AnimatedListDemo({ className }: { className?: string }) {
  return (
    <section className="py-20 bg-linear-to-b from-white via-gray-50/50 to-white">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 mb-4">
            <Bell className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-700">
              Live Activity Feed
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Real-time Inventory Alerts
          </h2>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
            Stay informed with instant notifications about stock levels,
            expiries, and sales activity
          </p>
        </div>

        {/* Animated List Container */}
        <div
          className={cn(
            "relative flex h-[600px] w-full flex-col overflow-hidden rounded-2xl bg-white/60 backdrop-blur-sm border border-gray-200 shadow-lg p-6",
            className
          )}
        >
          <AnimatedList className="h-full">
            {notifications.map((item, idx) => (
              <Notification {...item} key={idx} />
            ))}
          </AnimatedList>

          {/* Gradient fade at bottom */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-white via-white/80 to-transparent"></div>

          {/* Gradient fade at top */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-linear-to-b from-white via-white/80 to-transparent"></div>
        </div>
      </div>
    </section>
  );
}
