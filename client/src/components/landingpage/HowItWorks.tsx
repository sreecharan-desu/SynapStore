import { Bell, Package, TrendingUp } from "lucide-react";

const steps = [
  {
    id: "01",
    title: "Connect your catalog",
    description:
      "Scan or import your medicines, auto-categorize them, and set reorder points without spreadsheet busywork.",
    accent: "bg-brand-pale text-brand-primary-dark border-brand-primary/20",
    icon: Package,
    detailTitle: "Sync in minutes",
    detailCopy:
      "Barcode scan, CSV import, or manual add—whatever fits your workflow.",
  },
  {
    id: "02",
    title: "Set your availability",
    description:
      "Mirror your shelves in real time. Track batches, expiries, and stock positions across every location.",
    accent: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: TrendingUp,
    detailTitle: "Live dashboard",
    detailCopy:
      "Instant signals on stock-outs, fast movers, and aging inventory.",
  },
  {
    id: "03",
    title: "Choose how to meet demand",
    description:
      "Get proactive alerts and recommendations so the right medicines are always ready when patients need them.",
    accent: "bg-purple-100 text-purple-700 border-purple-200",
    icon: Bell,
    detailTitle: "Smart alerts",
    detailCopy:
      "Expiry warnings, low-stock nudges, and auto-reorder suggestions.",
  },
];

const HowItWorks = () => {
  return (
    <section
      id="how-it-works"
      className="py-24 relative overflow-hidden bg-background-page"
      aria-labelledby="how-it-works-heading"
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 right-0 w-[600px] h-[600px] bg-brand-primary-light/5 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-pale border border-brand-primary/20 text-sm font-semibold text-brand-primary-dark shadow-sm">
            <span className="w-2 h-2 rounded-full bg-brand-primary animate-pulse" />
            How it works
          </div>
          <h2
            id="how-it-works-heading"
            className="text-4xl md:text-5xl font-bold text-brand-text tracking-tight"
          >
            With us, inventory confidence is easy
          </h2>
          <p className="text-lg md:text-xl text-brand-text-muted max-w-3xl mx-auto leading-relaxed">
            Effortless setup, real-time visibility, and proactive
            alerts—designed for fast-moving pharmacies that can’t afford
            stockouts or waste.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <article
                key={step.id}
                className="group relative rounded-3xl bg-white/60 backdrop-blur-xl border border-white/50 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden ring-1 ring-white/50"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-primary via-brand-primary-light to-brand-highlight opacity-70 group-hover:opacity-100 transition-opacity" />
                <div className="p-8 flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-sm font-semibold border ${step.accent}`}
                    >
                      {step.id}
                    </span>
                    <div className="w-12 h-12 rounded-2xl bg-white/50 border border-white/60 flex items-center justify-center shadow-sm group-hover:bg-white transition-colors">
                      <Icon className="w-6 h-6 text-brand-text" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold text-brand-text tracking-tight">
                      {step.title}
                    </h3>
                    <p className="text-brand-text-muted leading-relaxed">
                      {step.description}
                    </p>
                  </div>

                  <div className="mt-2 rounded-2xl bg-white/40 border border-white/50 p-4 flex gap-3 group-hover:bg-white/60 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-white/80 border border-white/50 flex items-center justify-center shadow-sm">
                      <Icon className="w-5 h-5 text-brand-primary" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-brand-text">
                        {step.detailTitle}
                      </div>
                      <div className="text-sm text-brand-text-muted leading-relaxed">
                        {step.detailCopy}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
