import React from "react";
import { Link } from "react-router-dom";
import HeroSection from "../components/landingpage/HeroSection";
import HowItWorks from "../components/landingpage/HowItWorks";
import AnimatedInventoryShowcase from "../components/landingpage/AnimatedList";
import WhyChooseUs from "../components/landingpage/WhyChooseUs";
import Faq from "../components/landingpage/Faq";
import Testimonials from "../components/landingpage/Testimonials";
import Footer from "../components/landingpage/Footer";

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-transparent">
      {/* Navigation */}
   <nav
  id="main-nav"
  className="fixed top-0 left-0 right-0 z-50 bg-transparent backdrop-blur-sm border-b border-transparent transition-all duration-300"
>
  <div className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between">
    
    {/* Logo */}
    <div className="flex items-center gap-4">
      <div className="w-16 h-16 flex items-center justify-center">
        <img
          src="./logo.svg"
          alt="SynapStore Logo"
          className="w-14 h-14 object-contain"
          style={{
            filter:
              "invert(39%) sepia(98%) saturate(1000%) hue-rotate(190deg) brightness(90%) contrast(90%)",
          }}
        />
      </div>

      {/* Premium-looking text */}
      <span className="text-2xl font-extrabold tracking-wide text-gray-900">
        SynapStore
      </span>
    </div>

    {/* Desktop Nav */}
    <div className="hidden md:flex items-center">
      <Link
        to="/login"
        className="px-7 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/25 hover:-translate-y-0.5"
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
      <AnimatedInventoryShowcase />

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
