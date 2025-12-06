import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";

/**
 * WhyChooseUs — upgraded UI with animations (Tailwind + small inline CSS)
 * - Entrance fade+slide for the heading and cards
 * - Staggered list reveal for each list item
 * - Pulsing / pop check icons on the SynapStore side
 * - Floating gradient blobs in the background
 * - Respects prefers-reduced-motion
 */

const TraditionalItems = [
  "Manual counting and data entry",
  "Delayed stock updates",
  "No automated alerts",
  "Limited reporting capabilities",
  "Error-prone processes",
];

const SynapItems = [
  "Automated barcode scanning and RFID tracking",
  "Real-time inventory updates",
  "Smart alerts and notifications",
  "Advanced analytics and reporting",
  "99.9% accuracy guarantee",
];

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else mq.removeListener(handler);
    };
  }, []);
  return reduced;
}

export default function WhyChooseUs() {
  const reduced = usePrefersReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  // intersection for triggering staggered reveal
  useEffect(() => {
    const node = containerRef.current;
    if (!node || reduced || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [reduced]);

  return (
    <section
      className="relative py-24 bg-slate-50 overflow-hidden"
      aria-labelledby="why-heading"
      ref={containerRef}
    >
      {/* inline keyframes and helper classes */}
      <style>{`
        /* float for blobs */
        @keyframes floatY { 0%{transform:translateY(0)}50%{transform:translateY(-10px)}100%{transform:translateY(0)} }
        @keyframes fadeSlideUp { from{opacity:0; transform:translateY(18px)} to{opacity:1; transform:translateY(0)} }
        @keyframes pop { 0%{transform:scale(.9); opacity:0} 60%{transform:scale(1.05); opacity:1} 100%{transform:scale(1)} }
        .wc-float { animation: floatY 6s ease-in-out infinite; }
        .wc-fade { animation: fadeSlideUp .7s cubic-bezier(.2,.9,.3,1) both; }
        .wc-pop { animation: pop .5s cubic-bezier(.2,.9,.3,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .wc-float, .wc-fade, .wc-pop { animation: none !important; }
        }
      `}</style>

      {/* floating gradient blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className={`absolute top-8 -right-20 w-96 h-96 rounded-full blur-3xl bg-gradient-to-br from-blue-300/30 to-emerald-300/20 ${
            reduced ? "" : "wc-float"
          }`}
        />
        <div
          className={`absolute -left-12 bottom-8 w-80 h-80 rounded-full blur-3xl bg-gradient-to-br from-pink-300/20 to-violet-300/10 ${
            reduced ? "" : "wc-float"
          }`}
          style={{ animationDelay: "800ms" }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2
            id="why-heading"
            className={`text-4xl md:text-5xl font-extrabold text-slate-900 leading-tight ${
              inView ? "wc-fade" : "opacity-0"
            }`}
            style={{ animationDelay: "60ms" }}
          >
            Why choose{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-emerald-500">
              SynapStore
            </span>
            ?
          </h2>
          <p
            className={`mt-4 text-lg text-slate-600 max-w-2xl mx-auto ${
              inView ? "wc-fade" : "opacity-0"
            }`}
            style={{ animationDelay: "140ms" }}
          >
            See how we outperform traditional inventory management — faster
            decisions, fewer errors, and real savings.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Traditional card */}
          <article
            className={`relative bg-white rounded-2xl p-8 border border-slate-200 shadow-sm transform transition-transform hover:-translate-y-1 focus-within:-translate-y-1 ${
              inView ? "wc-fade" : "opacity-0"
            }`}
            style={{ animationDelay: "220ms" }}
            aria-label="Traditional inventory methods"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-semibold text-slate-900">
                Traditional Methods
              </h3>
              <div className="text-sm text-slate-500">Slow & manual</div>
            </div>

            <ul className="space-y-3">
              {TraditionalItems.map((t, i) => (
                <li
                  key={t}
                  className="flex items-start gap-3 opacity-0 transform translate-y-3"
                  style={{
                    animation:
                      inView && !reduced
                        ? `fadeSlideUp .5s cubic-bezier(.2,.9,.3,1) both ${
                            0.18 + i * 0.06
                          }s`
                        : undefined,
                    // fallback for reduced motion / not inView
                    opacity: inView || reduced ? 1 : 0,
                    transform: inView || reduced ? "translateY(0)" : undefined,
                  }}
                >
                  <span className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-full bg-red-50 flex items-center justify-center text-red-600 text-xs font-semibold">
                    ✕
                  </span>
                  <p className="text-slate-700">{t}</p>
                </li>
              ))}
            </ul>

            <div className="mt-6 text-xs text-slate-500">
              Traditional methods cause manual effort and higher error rates.
            </div>
          </article>

          {/* SynapStore card */}
          <article
            className={`relative rounded-2xl p-8 text-white shadow-xl overflow-hidden transform transition-transform hover:-translate-y-1 focus-within:-translate-y-1 ${
              inView ? "wc-fade" : "opacity-0"
            }`}
            style={{
              animationDelay: "260ms",
              background: "linear-gradient(135deg,#2563eb 0%,#059669 100%)",
            }}
            aria-label="SynapStore benefits"
          >
            {/* subtle shiny overlay */}
            <div className="pointer-events-none absolute inset-0 opacity-10 bg-[linear-gradient(90deg,rgba(255,255,255,0.06),transparent)] mix-blend-screen" />

            <div className="flex items-center justify-between mb-6 relative z-10">
              <h3 className="text-2xl font-semibold">SynapStore</h3>
              <div className="text-sm text-white/90">Fast & accurate</div>
            </div>

            <ul className="space-y-3 relative z-10">
              {SynapItems.map((t, i) => (
                <li
                  key={t}
                  className="flex items-start gap-3 opacity-0 transform translate-y-3"
                  style={{
                    animation:
                      inView && !reduced
                        ? `fadeSlideUp .5s cubic-bezier(.2,.9,.3,1) both ${
                            0.18 + i * 0.06
                          }s`
                        : undefined,
                    opacity: inView || reduced ? 1 : 0,
                    transform: inView || reduced ? "translateY(0)" : undefined,
                  }}
                >
                  <CheckCircle2
                    className={`w-7 h-7 flex-shrink-0 ${
                      inView ? "wc-pop" : ""
                    }`}
                    style={{ color: "white" }}
                    aria-hidden
                  />
                  <p className="text-white">{t}</p>
                </li>
              ))}
            </ul>

            <div className="mt-6 relative z-10 flex items-center gap-4">
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white/10 text-white/90 text-sm font-semibold">
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M12 2L19 8v8l-7 6-7-6V8l7-6z"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Enterprise ready
              </div>

              <div className="text-sm text-white/80">
                Deployed in pharmacies nationwide
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
