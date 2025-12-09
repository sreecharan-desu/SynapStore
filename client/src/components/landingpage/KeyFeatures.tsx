import { BarChart3, Bell, Package, Shield, Users, Zap } from "lucide-react";

const KeyFeatures = () => {
  return (
    <section id="features" className="py-24 relative overflow-hidden bg-background-page">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-border to-transparent" />

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-40 left-0 w-96 h-96 bg-brand-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-40 right-0 w-96 h-96 bg-brand-highlight/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-brand-text mb-6">
            Everything you need to manage inventory
          </h2>
          <p className="text-xl text-brand-text-muted max-w-2xl mx-auto">
            Powerful features designed for modern pharmacies
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            {
              icon: Package,
              title: "Real-Time Inventory Tracking",
              desc: "Track every medicine movement instantly with barcode scanning and RFID technology. Get accurate stock levels across all locations in real-time.",
              color: "text-brand-primary",
              bg: "bg-brand-pale",
            },
            {
              icon: Bell,
              title: "Smart Alerts & Notifications",
              desc: "Automatic notifications when stock falls below critical levels, medicines are expiring, or when it's time to reorder.",
              color: "text-brand-primary-dark",
              bg: "bg-emerald-50",
            },
            {
              icon: BarChart3,
              title: "Advanced Analytics",
              desc: "Comprehensive reports and insights on inventory patterns, sales trends, and stock turnover. Make data-driven decisions.",
              color: "text-purple-600",
              bg: "bg-purple-50",
            },
            {
              icon: Shield,
              title: "HIPAA Compliant & Secure",
              desc: "Enterprise-grade security with encryption, regular backups, and compliance with healthcare regulations. Your data is safe and protected.",
              color: "text-orange-600",
              bg: "bg-orange-50",
            },
            {
              icon: Zap,
              title: "Lightning Fast Performance",
              desc: "Built for speed with instant search, quick barcode scanning, and seamless multi-user access.",
              color: "text-pink-600",
              bg: "bg-pink-50",
            },
            {
              icon: Users,
              title: "Multi-Location Support",
              desc: "Manage inventory across multiple pharmacy locations from a single dashboard. Transfer stock between locations easily.",
              color: "text-cyan-600",
              bg: "bg-cyan-50",
            }
          ].map((feature, i) => (
            <div
              key={i}
              className="group relative p-8 rounded-3xl bg-white/60 backdrop-blur-xl border border-white/40 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              <div className={`w-14 h-14 rounded-2xl ${feature.bg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className={`w-7 h-7 ${feature.color}`} />
              </div>
              <h3 className="text-xl font-bold text-brand-text mb-3">
                {feature.title}
              </h3>
              <p className="text-brand-text-muted leading-relaxed">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default KeyFeatures;
