// HeroSection.tsx

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Star, Sparkles, TrendingUp } from "lucide-react";
import { Particles } from "@/components/ui/particles";

type Stat = {
  id: number;
  value: number;
  label: string;
  format: (v: number) => string;
};

const stats: Stat[] = [
  {
    id: 1,
    value: 10000,
    label: "Medicines Tracked",
    format: (v: number) =>
      v >= 1000 ? `${Math.round(v / 1000)}K+` : `${Math.round(v)}`,
  },
  {
    id: 2,
    value: 500,
    label: "Pharmacies Onboarded",
    format: (v: number) =>
      v >= 1000 ? `${Math.round(v / 1000)}K+` : `${Math.round(v)}`,
  },
  {
    id: 3,
    value: 99.9,
    label: "System Uptime",
    format: (v: number) => `${(Math.round(v * 10) / 10).toFixed(1)}%`,
  },
  {
    id: 4,
    value: 24,
    label: "Premium Support",
    format: (v: number) => `${Math.round(v)}/7`,
  },
];

type InViewState = { ref: RefObject<HTMLDivElement | null>; inView: boolean };

function useInViewOnce(
  reduced: boolean,
  options: { rootMargin?: string; threshold?: number } = {}
): InViewState {
  const { rootMargin = "0px", threshold = 0.3 } = options;
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (reduced) {
      setInView(true);
      return;
    }

    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [reduced, rootMargin, threshold]);

  return { ref, inView };
}

export default function HeroSection() {
  const [reduced, setReduced] = useState(false);

  const badgeInView = useInViewOnce(reduced);
  const headingInView = useInViewOnce(reduced);
  const subheadInView = useInViewOnce(reduced);
  const ctaInView = useInViewOnce(reduced);
  const statsInView = useInViewOnce(reduced);
  const featuresInView = useInViewOnce(reduced);

  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReduced(mq.matches);
      const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
      if (mq.addEventListener) mq.addEventListener("change", handler);
      else mq.addListener(handler);
      return () => {
        if (mq.removeEventListener) mq.removeEventListener("change", handler);
        else mq.removeListener(handler);
      };
    }
  }, []);

  return (
    <section
      className="relative pt-32 pb-32 overflow-hidden bg-gradient-to-b from-slate-50 via-blue-50/30 to-emerald-50/40"
      aria-labelledby="hero-heading"
    >
      <style>{`
        @keyframes floatY { 0%,100%{transform:translateY(0) rotate(0deg);}50%{transform:translateY(-16px) rotate(1deg);} }
        @keyframes floatX { 0%,100%{transform:translateX(0);}50%{transform:translateX(12px);} }
        @keyframes softFadeUp { from{opacity:0;transform:translateY(20px);} to{opacity:1;transform:translateY(0);} }
        .float-y{animation:floatY 6s ease-in-out infinite}
        .float-x{animation:floatX 8s ease-in-out infinite}
        .fade-up{animation:softFadeUp .8s cubic-bezier(.2,.9,.3,1) both;will-change:transform,opacity}
        @media (prefers-reduced-motion: reduce) { .float-y,.float-x,.fade-up{animation:none!important} }
        .gradient-text{background:linear-gradient(135deg,#3b82f6 0%,#10b981 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .glass{background:rgba(255,255,255,0.7);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
      `}</style>

      {/* Background + Particles + blobs */}
      <div className="pointer-events-none absolute inset-0 -z-0">
        {/* Particles: placed behind blobs but above page base; use -z-20 if you want even further back */}
        <div className="absolute inset-0 -z-20">
          <Particles
            className="w-full h-full"
            quantity={200}
            color="#64748b"
            size={1.5}
            staticity={50}
            ease={50}
          />
        </div>

        {/* Gradient blobs above particles */}
        <div
          className={`absolute top-20 right-20 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl -z-10 ${
            reduced ? "" : "float-y"
          }`}
        />
        <div
          className={`absolute bottom-20 left-20 w-80 h-80 bg-emerald-400/20 rounded-full blur-3xl -z-10 ${
            reduced ? "" : "float-x"
          }`}
        />
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl -z-10 ${
            reduced ? "" : "float-y"
          }`}
          style={{ animationDelay: "1s" }}
        />

        {/* Grid pattern (fixed utility syntax) */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.03)_1px,transparent_1px)] bg-[size:64px_64px] -z-10" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 z-10">
        <div className="text-center mt-8">
          <h1
            id="hero-heading"
            ref={headingInView.ref}
            className={`text-6xl md:text-7xl lg:text-8xl font-black leading-tight tracking-tight ${
              headingInView.inView ? "fade-up" : ""
            }`}
            style={{ animationDelay: reduced ? undefined : "80ms" }}
          >
            <span className="block text-slate-900 mb-2">Smart Pharmacy</span>
            <span className="block gradient-text relative">
              Inventory Intelligence
            </span>
          </h1>

          <p
            ref={subheadInView.ref}
            className={`mt-10 max-w-3xl mx-auto text-xl md:text-2xl text-slate-600 leading-relaxed font-medium ${
              subheadInView.inView ? "fade-up" : ""
            }`}
            style={{ animationDelay: reduced ? undefined : "100ms" }}
          >
            Turn daily inventory into{" "}
            <span className="text-blue-600 font-semibold">
              predictive insights
            </span>
            . Reduce expiries, avoid stockouts, and run your pharmacy with{" "}
            <span className="text-emerald-600 font-semibold">
              surgical precision
            </span>
            .
          </p>

          <div
            ref={ctaInView.ref}
            className={`mt-12 flex flex-col sm:flex-row items-center justify-center gap-5 ${
              ctaInView.inView ? "fade-up" : ""
            }`}
            style={{ animationDelay: reduced ? undefined : "120ms" }}
          >
            <button
              onClick={() => navigate("/login")}
              className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-full bg-gradient-to-r from-blue-600 to-emerald-600 text-white font-bold text-lg shadow-2xl hover:scale-105 transition-transform"
              aria-label="Get Started"
            >
              <span className="relative z-10">Get Started</span>
              <ArrowRight className="w-5 h-5 relative z-10" />
              <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity bg-black/10" />
            </button>
          </div>
        </div>

        <div
          ref={statsInView.ref}
          className={`mt-16 ${statsInView.inView ? "fade-up" : ""}`}
          style={{ animationDelay: reduced ? undefined : "160ms" }}
        >
          <div className="relative max-w-6xl mx-auto rounded-3xl glass border border-white/60 p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shadow-lg">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="text-sm text-slate-500 font-medium">
                    Live Dashboard
                  </div>
                  <div className="text-lg font-bold text-slate-900">
                    Real-time Inventory
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 border border-green-200">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-semibold text-green-700">
                  All Systems Operational
                </span>
              </div>
            </div>

            <div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {stats.map((s, i) => (
                  <StatCard
                    key={s.id}
                    value={s.value}
                    label={s.label}
                    format={s.format}
                    reduced={reduced}
                    delay={i * 150}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div
          ref={featuresInView.ref}
          className={`mt-12 flex flex-wrap items-center justify-center gap-6 ${
            featuresInView.inView ? "fade-up" : ""
          }`}
          style={{ animationDelay: reduced ? undefined : "200ms" }}
        >
          {[
            "Auto-Reordering",
            "Expiry Alerts",
            "Sales Analytics",
            "Multi-location",
          ].map((feature, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-5 py-2 rounded-full bg-white/60 backdrop-blur border border-slate-200 text-slate-700 font-medium shadow-sm"
            >
              <div className="w-2 h-2 bg-emerald-500 rounded-full" />
              {feature}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface StatCardProps {
  value: number;
  label: string;
  format: (v: number) => string;
  reduced: boolean;
  delay?: number;
}

function StatCard({ value, label, format, reduced, delay = 0 }: StatCardProps) {
  const [count, setCount] = useState<number>(reduced ? value : 0);
  const rafRef = useRef<number | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  useEffect(() => {
    if (reduced || !started) return;
    let start: number | null = null;
    const duration = 1200;

    function step(timestamp: number) {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = value * eased;
      if (progress >= 1) {
        setCount(value);
      } else {
        setCount(current);
      }
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    }

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, reduced, started]);

  return (
    <div className="flex flex-col items-center text-center group cursor-default">
      <div className="text-4xl md:text-5xl font-black gradient-text group-hover:scale-110 transition-transform">
        {format(count)}
      </div>
      <div className="text-sm text-slate-600 font-medium mt-1">{label}</div>
    </div>
  );
}
