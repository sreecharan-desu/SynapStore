// CTAAndFooter.tsx

/* Simple icon component — marked aria-hidden and with improved className handling */
const ArrowRight = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
    focusable="false"
    className="transform transition-transform group-hover:translate-x-1"
  >
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

export default function CTAAndFooter() {
  const year = new Date().getFullYear();

  return (
    <div className="w-full bg-background-page">
      {/* Styles kept inline for single-file convenience */}
      <style>{`
        /* Respect user's reduced motion preference */
        @media (prefers-reduced-motion: reduce) {
          .animate-fadeInUp,
          .animate-float,
          .animate-pulse-glow,
          .animate-pulse-status,
          .gradient-animated {
            animation: none !important;
          }
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        @keyframes pulse-glow {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.2); }
        }

        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        @keyframes pulse-status {
          0%   { transform: scale(1); opacity: 0.95; }
          50%  { transform: scale(1.6); opacity: 0.45; }
          100% { transform: scale(1); opacity: 0.95; }
        }

        .animate-pulse-status {
          animation: pulse-status 1.8s ease-in-out infinite;
          transform-origin: center;
          will-change: transform, opacity;
          animation-fill-mode: both;
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out forwards;
          animation-fill-mode: both;
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
          transform-origin: center;
        }

        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }

        .gradient-animated {
          background: linear-gradient(-45deg, #10b981, #059669, #14b8a6, #0d9488);
          background-size: 400% 400%;
          animation: gradient-shift 8s ease infinite;
        }

        /* Stagger helpers */
        .stagger-1 { animation-delay: 0.1s; opacity: 0; }
        .stagger-2 { animation-delay: 0.2s; opacity: 0; }
        .stagger-3 { animation-delay: 0.3s; opacity: 0; }
        .stagger-4 { animation-delay: 0.4s; opacity: 0; }
        .stagger-5 { animation-delay: 0.5s; opacity: 0; }

        /* Focus-visible for keyboard users */
        .focus-ring:focus-visible {
          outline: 3px solid rgba(16, 185, 129, 0.3);
          outline-offset: 2px;
          border-radius: 0.75rem;
        }

        /* Hover underline effect for textual links */
        .link-hover { position: relative; transition: all 0.22s ease; }
        .link-hover::after {
          content: '';
          position: absolute;
          width: 0;
          height: 2px;
          bottom: -2px;
          left: 0;
          background-color: #10b981;
          transition: width 0.25s ease;
        }
        .link-hover:hover::after { width: 100%; }

        /* Small utilities for CTAs */
        .cta-button { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .cta-button:hover { transform: scale(1.05); box-shadow: 0 20px 40px rgba(16, 185, 129, 0.3); }
        .cta-button:active { transform: scale(0.985); }

        .logo-container { transition: transform 0.28s ease; will-change: transform; }
        .logo-container:hover { transform: rotate(5deg) scale(1.05); }
      `}</style>

      {/* CTA Section */}
      <section className="relative py-24 gradient-animated overflow-hidden">
        {/* Animated Background Orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-float" />
          <div
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-teal-300/10 rounded-full blur-3xl animate-float"
            style={{ animationDelay: "2s" }}
          />
        </div>

        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight animate-fadeInUp stagger-1 drop-shadow-lg">
            Ready to transform your pharmacy?
          </h2>

          <p className="text-xl md:text-2xl text-white/95 mb-10 max-w-3xl mx-auto leading-relaxed animate-fadeInUp stagger-2 drop-shadow">
            Join thousands of pharmacies already using{" "}
            <span className="font-bold text-white">SynapStore</span> to
            streamline operations and save time.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fadeInUp stagger-3">
            <a
              href="/login"
              className="cta-button group inline-flex items-center justify-center gap-2 px-10 py-5 bg-white text-emerald-700 rounded-full font-bold text-lg shadow-2xl hover:shadow-white/20 focus:outline-none focus:ring-4 focus:ring-white/30 focus-ring"
              aria-label="Get started with SynapStore - Login"
            >
              <span>Get Started Free</span>
              <ArrowRight />
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-8 items-start">
            {/* Brand Column */}
            <div className="animate-fadeInUp stagger-1">
              <div className="flex items-center gap-5 mb-4">
                <div className="logo-container">
                  <img src="/logo.svg" alt="SynapStore logo" className="w-32 h-32 object-contain" />
                </div>
                <span className="text-3xl font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent">
                  SynapStore
                </span>
              </div>
            </div>

            {/* Description Column */}
            <div className="md:col-span-2 animate-fadeInUp stagger-2 flex items-center">
              <p className="text-slate-700 leading-relaxed text-base md:text-lg max-w-3xl font-medium">
                Smart pharmacy inventory management trusted by pharmacies nationwide.
              </p>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-slate-200 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-slate-600 font-medium">
              &copy; {year} SynapStore. All rights reserved.
            </p>

            <div className="flex items-center gap-6 text-sm">
              {/* Pulsing Status Dot */}
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse-status" aria-hidden="true" />
                <span className="text-slate-700 font-medium">All Systems Operational</span>
              </div>

              <a href="#" className="link-hover text-slate-600 hover:text-emerald-600 font-medium">Security</a>
              <a href="#" className="link-hover text-slate-600 hover:text-emerald-600 font-medium">Privacy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
