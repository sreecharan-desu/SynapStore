import { useState } from "react";

// Simple icon components
const ArrowRight = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

const Twitter = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const Facebook = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const Instagram = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
  </svg>
);

const Linkedin = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

export default function CTAAndFooter() {
  const [, setHoveredSocial] = useState(null);

  return (
    <div className="w-full bg-gray-50">
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @keyframes pulse-glow {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.2);
          }
        }

        @keyframes gradient-shift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out forwards;
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }

        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }

        .gradient-animated {
          background: linear-gradient(-45deg, #2563eb, #3b82f6, #4f46e5, #6366f1);
          background-size: 400% 400%;
          animation: gradient-shift 8s ease infinite;
        }

        .stagger-1 { animation-delay: 0.1s; opacity: 0; }
        .stagger-2 { animation-delay: 0.2s; opacity: 0; }
        .stagger-3 { animation-delay: 0.3s; opacity: 0; }
        .stagger-4 { animation-delay: 0.4s; opacity: 0; }
        .stagger-5 { animation-delay: 0.5s; opacity: 0; }

        .link-hover {
          position: relative;
          transition: all 0.3s ease;
        }

        .link-hover::after {
          content: '';
          position: absolute;
          width: 0;
          height: 2px;
          bottom: -2px;
          left: 0;
          background-color: #2563eb;
          transition: width 0.3s ease;
        }

        .link-hover:hover::after {
          width: 100%;
        }

        .social-icon {
          transition: all 0.3s ease;
        }

        .social-icon:hover {
          transform: translateY(-4px);
          background-color: #2563eb;
          color: white;
        }

        .cta-button {
          transition: all 0.3s ease;
        }

        .cta-button:hover {
          transform: scale(1.05);
          box-shadow: 0 20px 40px rgba(37, 99, 235, 0.3);
        }

        .cta-button:active {
          transform: scale(0.98);
        }

        .logo-container {
          transition: transform 0.3s ease;
        }

        .logo-container:hover {
          transform: rotate(5deg) scale(1.05);
        }
      `}</style>

      {/* CTA Section */}
      <section className="relative py-24 gradient-animated overflow-hidden">
        {/* Animated Background Orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl animate-float" />
          <div
            className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl animate-float"
            style={{ animationDelay: "1s" }}
          />
          <div
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-400/10 rounded-full blur-3xl animate-float"
            style={{ animationDelay: "2s" }}
          />
        </div>

        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight animate-fadeInUp stagger-1">
            Ready to transform your pharmacy?
          </h2>

          <p className="text-xl md:text-2xl text-blue-50 mb-10 max-w-3xl mx-auto leading-relaxed animate-fadeInUp stagger-2">
            Join thousands of pharmacies already using{" "}
            <span className="font-semibold text-white">SynapStore</span> to
            streamline operations and save time.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fadeInUp stagger-3">
            <a
              href="/login"
              className="cta-button inline-flex items-center justify-center gap-2 px-10 py-5 bg-white text-blue-600 rounded-xl font-semibold text-lg shadow-2xl focus:outline-none focus:ring-4 focus:ring-white/30"
            >
              <span>Start Free Trial</span>
              <ArrowRight />
            </a>

            <button className="cta-button px-10 py-5 border-2 border-white/80 text-white rounded-xl font-semibold text-lg hover:bg-white/10 hover:border-white backdrop-blur-sm focus:outline-none focus:ring-4 focus:ring-white/20">
              Contact Sales
            </button>
          </div>

          <p className="text-blue-50/90 mt-8 text-base animate-fadeInUp stagger-4">
            No credit card required • <strong>14-day free trial</strong> •
            Cancel anytime
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-8 md:gap-12 mb-12">
            {/* Brand Column */}
            <div className="col-span-2 md:col-span-2 animate-fadeInUp stagger-1">
              <div className="flex items-center gap-3 mb-6">
                <div className="logo-container w-11 h-11 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
                  <img src="/logo.svg" alt="SynapStore Logo" />
                </div>
                <span className="text-2xl font-bold text-gray-900">
                  SynapStore
                </span>
              </div>
              <p className="text-gray-600 mb-6 max-w-xs leading-relaxed">
                Smart pharmacy inventory management trusted by 500+ pharmacies
                nationwide.
              </p>

              <div className="flex items-center gap-2 mb-8">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse-glow" />
                <span className="text-sm text-gray-600 font-medium">
                  All systems operational
                </span>
              </div>

              <div className="flex items-center gap-3">
                {[
                  { Icon: Twitter, label: "Twitter" },
                  { Icon: Facebook, label: "Facebook" },
                  { Icon: Instagram, label: "Instagram" },
                  { Icon: Linkedin, label: "LinkedIn" },
                ].map(({ Icon, label }, i) => (
                  <a
                    key={i}
                    href="#"
                    aria-label={label}
                    className="social-icon p-2.5 rounded-lg bg-gray-100 text-gray-600"
                    onMouseEnter={() => setHoveredSocial(null)}
                    onMouseLeave={() => setHoveredSocial(null)}
                  >
                    <Icon />
                  </a>
                ))}
              </div>
            </div>

            {/* Product Column */}
            <div className="animate-fadeInUp stagger-2">
              <h4 className="text-gray-900 font-bold mb-5 text-sm uppercase tracking-wider">
                Product
              </h4>
              <ul className="space-y-3">
                {["Features", "How it Works", "Pricing", "Integrations"].map(
                  (item, i) => (
                    <li key={i}>
                      <a
                        href={`#${item.toLowerCase().replace(/\s/g, "-")}`}
                        className="link-hover text-gray-600 hover:text-blue-600 inline-block"
                      >
                        {item}
                      </a>
                    </li>
                  )
                )}
              </ul>
            </div>

            {/* Resources Column */}
            <div className="animate-fadeInUp stagger-3">
              <h4 className="text-gray-900 font-bold mb-5 text-sm uppercase tracking-wider">
                Resources
              </h4>
              <ul className="space-y-3">
                {["Documentation", "API Reference", "Blog", "Support"].map(
                  (item, i) => (
                    <li key={i}>
                      <a
                        href="#"
                        className="link-hover text-gray-600 hover:text-blue-600 inline-block"
                      >
                        {item}
                      </a>
                    </li>
                  )
                )}
              </ul>
            </div>

            {/* Company Column */}
            <div className="animate-fadeInUp stagger-4">
              <h4 className="text-gray-900 font-bold mb-5 text-sm uppercase tracking-wider">
                Company
              </h4>
              <ul className="space-y-3">
                {["About", "Careers", "Contact", "Press"].map((item, i) => (
                  <li key={i}>
                    <a
                      href="#"
                      className="link-hover text-gray-600 hover:text-blue-600 inline-block"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal Column */}
            <div className="animate-fadeInUp stagger-5">
              <h4 className="text-gray-900 font-bold mb-5 text-sm uppercase tracking-wider">
                Legal
              </h4>
              <ul className="space-y-3">
                {["Privacy Policy", "Terms of Service", "Cookie Policy"].map(
                  (item, i) => (
                    <li key={i}>
                      <a
                        href="#"
                        className="link-hover text-gray-600 hover:text-blue-600 inline-block"
                      >
                        {item}
                      </a>
                    </li>
                  )
                )}
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-gray-200 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-600">
              &copy; {new Date().getFullYear()} SynapStore. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm">
              <a
                href="#"
                className="link-hover text-gray-600 hover:text-blue-600"
              >
                Security
              </a>
              <a
                href="#"
                className="link-hover text-gray-600 hover:text-blue-600"
              >
                Status
              </a>
              <a
                href="#"
                className="link-hover text-gray-600 hover:text-blue-600"
              >
                Sitemap
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
