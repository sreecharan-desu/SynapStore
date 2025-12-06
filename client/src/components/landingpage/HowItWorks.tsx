import { Bell, Package, TrendingUp } from "lucide-react";

const steps = [
  {
    id: "01",
    title: "Connect your catalog",
    description:
      "Scan or import your medicines, auto-categorize them, and set reorder points without spreadsheet busywork.",
    accent: "bg-blue-100 text-blue-700 border-blue-200",
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
      className="py-20 bg-gray-50/70 border-t border-gray-100"
      aria-labelledby="how-it-works-heading"
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-gray-200 text-sm font-semibold text-gray-700 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            How it works
          </div>
          <h2
            id="how-it-works-heading"
            className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight"
          >
            With us, inventory confidence is easy
          </h2>
          <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
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
                className="relative rounded-3xl bg-white border border-gray-200 shadow-[0_20px_60px_-28px_rgba(0,0,0,0.25)] hover:shadow-[0_24px_70px_-32px_rgba(0,0,0,0.28)] transition-all duration-300 overflow-hidden"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-blue-500 via-emerald-500 to-purple-500 opacity-70" />
                <div className="p-8 flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-sm font-semibold border ${step.accent}`}
                    >
                      {step.id}
                    </span>
                    <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-gray-700" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold text-gray-900 tracking-tight">
                      {step.title}
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                      {step.description}
                    </p>
                  </div>

                  <div className="mt-2 rounded-2xl bg-gray-50 border border-gray-200 p-4 flex gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                      <Icon className="w-5 h-5 text-gray-700" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-gray-900">
                        {step.detailTitle}
                      </div>
                      <div className="text-sm text-gray-600 leading-relaxed">
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
