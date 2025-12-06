import React from "react";
import { Link } from "react-router-dom";
import HeroSection from "./HeroSection";
import HowItWorks from "./HowItWorks";
import { AnimatedListDemo } from "./AnimatedList";
import WhyChooseUs from "./WhyChooseUs";
import Faq from "./Faq";
import Testimonials from "./Testimonials";
import Footer from "./Footer";

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-transparent">
      {/* Navigation */}
      <nav
        id="main-nav"
        className="fixed top-0 left-0 right-0 z-50 bg-transparent backdrop-blur-sm border-b border-transparent transition-all duration-300"
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 flex items-center justify-center">
              <img
                src="./logo.svg"
                alt="SynapStore Logo"
                className="w-16 h-16 object-contain"
                style={{
                  filter:
                    "invert(39%) sepia(98%) saturate(1000%) hue-rotate(190deg) brightness(90%) contrast(90%)",
                }}
              />
            </div>
            <span className="text-xl font-bold text-gray-900">SynapStore</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <a
              href="#features"
              className="text-gray-700 hover:text-gray-900 transition-all duration-200 hover:-translate-y-0.5"
            >
              Features
            </a>

            <a
              href="#how-it-works"
              className="text-gray-700 hover:text-gray-900 transition-all duration-200 hover:-translate-y-0.5"
            >
              How it Works
            </a>

            <a
              href="#pricing"
              className="text-gray-700 hover:text-gray-900 transition-all duration-200 hover:-translate-y-0.5"
            >
              Pricing
            </a>

            <a
              href="#faq"
              className="text-gray-700 hover:text-gray-900 transition-all duration-200 hover:-translate-y-0.5"
            >
              FAQ
            </a>

            <Link
              to="/login"
              className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-all hover:-translate-y-0.5"
            >
              Sign in
            </Link>

            <Link
              to="/login"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/25 hover:-translate-y-0.5"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <HeroSection />

      {/* How It Works - 3 Steps */}
      <HowItWorks />
      {/* Key Features */}
      <AnimatedListDemo />

      {/* Comparison Section */}
      <WhyChooseUs />

      {/* FAQ Section */}
      <Faq />

      {/* Testimonials */}
      <Testimonials />

      {/* CTA Section */}
      <Footer />
    </div>
  );
};

export default LandingPage;
