// HeroSection.tsx
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Particles } from "@/components/ui/particles";
import { motion } from "framer-motion";

export default function HeroSection() {
  const navigate = useNavigate();

  return (
    <section
      className="relative pt-32 pb-32 overflow-hidden bg-background-page min-h-[90vh] flex items-center"
      aria-labelledby="hero-heading"
    >
      {/* Background Gradients */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ x: [0, 50, 0], y: [0, 30, 0], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-brand-primary/20 rounded-full blur-[100px]"
        />
        <motion.div
          animate={{ x: [0, -30, 0], y: [0, 50, 0], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-brand-highlight/20 rounded-full blur-[100px]"
        />
      </div>

      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.03)_1px,transparent_1px)] bg-[size:64px_64px] -z-10" />

      {/* Particles */}
      <div className="absolute inset-0 -z-20">
        <Particles
          className="w-full h-full"
          quantity={150}
          color="#64748b"
          size={1.5}
          staticity={50}
          ease={50}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 z-10 w-full text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <h1
            id="hero-heading"
            className="text-6xl md:text-7xl lg:text-8xl font-black leading-tight tracking-tight"
          >
            <span className="block text-brand-text mb-2">Smart Pharmacy</span>
            <span className="bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
              Inventory Intelligence
            </span>
          </h1>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="mt-8 max-w-3xl mx-auto text-xl md:text-2xl text-slate-600 leading-relaxed font-medium"
        >
          Turn daily inventory into{" "}
          <span className="text-emerald-600 font-semibold">
            predictive insights
          </span>
          . Reduce expiries, avoid stockouts, and run your pharmacy with{" "}
          <span className="text-teal-600 font-semibold">
            surgical precision
          </span>
          .
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-5"
        >
          <button
            onClick={() => navigate("/login")}
            className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-full bg-slate-900 text-white font-bold text-lg shadow-2xl hover:bg-slate-800 transition-all hover:-translate-y-1 hover:shadow-emerald-500/20"
            aria-label="Get Started"
          >
            <span className="relative z-10">
              Join us today
            </span>
            <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
            <div className="absolute inset-0 rounded-full ring-2 ring-white/10 group-hover:ring-white/20 transition-all" />
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-16 flex flex-wrap items-center justify-center gap-4"
        >
          {[
            "Auto-Reordering",
            "Expiry Alerts",
            "Sales Analytics",
            "Multi-location",
          ].map((feature, i) => (
            <motion.div
              key={i}
              whileHover={{ scale: 1.05, backgroundColor: "rgba(255, 255, 255, 0.9)" }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/60 backdrop-blur-md border border-slate-200/60 text-slate-700 font-medium shadow-sm transition-colors cursor-default"
            >
              <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              {feature}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}


