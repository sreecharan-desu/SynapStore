// CTAAndFooter.tsx
import { MaskContainer } from "@/components/ui/svg-mask-effect";
import { Twitter, Linkedin, Github } from "lucide-react";

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
      <section className="relative w-full border-t border-slate-100 bg-slate-50">
        <MaskContainer
          revealText={
            <div className="flex flex-col items-center justify-center text-center p-10 mt-10 h-full w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
              <h2 className="text-5xl md:text-7xl font-extrabold mb-8 tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-slate-900 via-slate-600 to-slate-400">
                Ready to <span className="text-slate-900">scale?</span>
              </h2>
              <p className="text-xl md:text-2xl text-slate-500 mb-12 max-w-3xl mx-auto leading-relaxed font-light">
                Your pharmacy deserves a system that works as hard as you do.
                <br />
                <span className="text-sm font-semibold uppercase tracking-widest mt-8 flex items-center justify-center gap-2 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" />
                  Hover to reveal
                </span>
              </p>
              <div className="px-8 py-4 rounded-full border border-dashed border-slate-300 text-slate-400 text-sm font-medium tracking-wide">
                synapstore.com/start
              </div>
            </div>
          }
          className="h-[30rem] rounded-none border-b border-slate-200 bg-slate-50"
          revealSize={500}
        >
          <div className="flex flex-col items-center justify-center text-center p-10 mt-10 h-full w-full">
            <h2 className="text-5xl md:text-7xl font-extrabold text-white mb-8 tracking-tighter drop-shadow-2xl">
              Start <span className="text-emerald-300">Syncing.</span>
            </h2>
            <p className="text-xl md:text-2xl text-white/90 mb-12 max-w-3xl mx-auto leading-relaxed font-medium">
              Join 5,000+ pharmacies modernizing their stack today.
            </p>
            <a
              href="/login"
              className="inline-flex items-center justify-center gap-3 px-12 py-6 bg-white text-emerald-700 rounded-full font-bold text-xl shadow-[0_0_40px_-10px_rgba(255,255,255,0.5)] hover:bg-black hover:scale-105 transition-all"
            >
              Get Started Free
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-6 h-6"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </a>
          </div>
        </MaskContainer>
      </section>

      {/* FOOTER */}
      {/* FOOTER */}
      <footer className="relative bg-white pt-24 pb-12 overflow-hidden">
        {/* Background Decor */}
        <div className="absolute inset-0 w-full h-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] opacity-50 pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-24 bg-gradient-to-b from-slate-50 to-transparent pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col items-center justify-center text-center">

          {/* Brand Section */}
          <div className="mb-10 space-y-6 max-w-2xl mx-auto">
            <div className="flex items-center justify-center gap-3 mb-2">
              <img src="/logo.svg" alt="SynapStore Logo" className="w-32 h-32 mt-5 -mr-7 object-contain" />
              <span className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent tracking-tight">SynapStore</span>
            </div>

            <p className="text-lg text-slate-500 leading-relaxed font-medium">
              The intelligent inventory operating system for modern pharmacies. <br />
              Streamlining workflows, preventing stockouts, and maximizing profitability.
            </p>

            {/* Social Links */}
            <div className="flex items-center justify-center gap-8 pt-4">
              <a href="https://www.synapstore.me" target="_blank" className="group flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 group-hover:text-sky-500 group-hover:border-sky-500/30 group-hover:shadow-sky-500/20 group-hover:scale-110 transition-all duration-300">
                  <Twitter className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-slate-400 group-hover:text-sky-600 transition-colors opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 duration-300">Twitter</span>
              </a>
              <a href="https://www.synapstore.me" target="_blank" className="group flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 group-hover:text-blue-600 group-hover:border-blue-600/30 group-hover:shadow-blue-600/20 group-hover:scale-110 transition-all duration-300">
                  <Linkedin className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-slate-400 group-hover:text-blue-700 transition-colors opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 duration-300">LinkedIn</span>
              </a>
              <a href="https://github.com/sreecharan-desu/SynapStore" target="_blank" className="group flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 group-hover:text-slate-900 group-hover:border-slate-900/30 group-hover:shadow-slate-900/20 group-hover:scale-110 transition-all duration-300">
                  <Github className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-slate-400 group-hover:text-slate-900 transition-colors opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 duration-300">GitHub</span>
              </a>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="w-full border-t border-dashed border-slate-200 pt-8 mt-8 flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-slate-500">
            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
              <p className="font-medium">&copy; {year} SynapStore Inc.</p>
              <div className="flex items-center gap-4 text-xs font-medium">
                <a href="#" className="hover:text-emerald-600 transition-colors">Privacy Policy</a>
                <a href="#" className="hover:text-emerald-600 transition-colors">Terms of Service</a>
                <a href="#" className="hover:text-emerald-600 transition-colors">Cookies</a>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black border border-emerald-100 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-black opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-black"></span>
              </span>
              <span className="text-emerald-700 font-bold text-xs tracking-wide uppercase">All Systems Normal</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
