import { useState } from "react";

// Simple icon component
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

        /* New pulse-status animation */
        @keyframes pulse-status {
          0% {
            transform: scale(1);
            opacity: 0.95;
          }
          50% {
            transform: scale(1.6);
            opacity: 0.45;
          }
          100% {
            transform: scale(1);
            opacity: 0.95;
          }
        }

        .animate-pulse-status {
          animation: pulse-status 1.8s ease-in-out infinite;
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
              <span>Get Started</span>
              <ArrowRight />
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER - Minimal & Professional (removed product/support lists and social icons) */}
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-8 items-start">
            {/* Brand Column */}
            <div className="animate-fadeInUp stagger-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="logo-container w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
                  <img src="/logo.svg" alt="SynapStore Logo" />
                </div>
                <span className="text-2xl font-bold text-gray-900">
                  SynapStore
                </span>
              </div>
            </div>

            {/* Description Column (moved here, improved wording) */}
            <div className="md:col-span-2 animate-fadeInUp stagger-2 flex items-center">
              <p className="text-gray-700 leading-relaxed text-base md:text-lg max-w-3xl">
                Smart pharmacy inventory management trusted by pharmacies nationwide.
              </p>
            </div>
          </div>

          {/* Bottom Bar */}
         {/* Bottom Bar */}
<div className="border-t border-gray-200 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
  <p className="text-sm text-gray-600">
    &copy; {new Date().getFullYear()} SynapStore. All rights reserved.
  </p>

  <div className="flex items-center gap-6 text-sm">
    {/* Pulsing Status Dot Only */}
    <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse-status" />

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
      Security
    </a>
  </div>
</div>

        </div>
      </footer>
    </div>
  );
}
