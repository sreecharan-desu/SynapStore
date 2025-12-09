import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import HeroSection from "../components/landingpage/HeroSection";
import HowItWorks from "../components/landingpage/HowItWorks";
import AnimatedInventoryShowcase from "../components/landingpage/AnimatedList";
import WhyChooseUs from "../components/landingpage/WhyChooseUs";
import Testimonials from "../components/landingpage/Testimonials";
import Footer from "../components/landingpage/Footer";
import KeyFeatures from "../components/landingpage/KeyFeatures";

const LandingPage: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="relative min-h-screen w-full bg-background-page selection:bg-brand-primary selection:text-white overflow-x-hidden">
      {/* Navigation */}
      <nav
        id="main-nav"
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-white/80 backdrop-blur-md shadow-sm" : "bg-transparent"
          }`}
      >
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 flex items-center justify-center bg-white rounded-xl shadow-md border border-brand-primary/20 transition-transform hover:scale-105 duration-300">
              <img
                src="/logo.svg"
                alt="SynapStore Logo"
                className="w-8 h-8 object-contain"
              />
            </div>
            <span className="text-2xl font-extrabold bg-gradient-to-r from-brand-primary-dark via-brand-primary to-brand-primary-light bg-clip-text text-transparent tracking-tight">
              SynapStore
            </span>
          </div>

          <div className="hidden md:flex items-center gap-6">

            <Link
              to="/login"
              className="px-6 py-2.5  text-white rounded-full font-medium hover:bg-brand-primary-dark transition-all shadow-lg hover:shadow-brand-primary/25 hover:-translate-y-0.5"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <HeroSection />

      <div className="relative z-10 w-full bg-background-page">
        <KeyFeatures />
        <WhyChooseUs />
        <HowItWorks />
        <AnimatedInventoryShowcase />
        <Testimonials />
        <Footer />
      </div>
    </div>
  );
};

export default LandingPage;
