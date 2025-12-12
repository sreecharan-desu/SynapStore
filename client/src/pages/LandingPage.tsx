import React, { useEffect, useState } from "react";
import HeroSection from "../components/landingpage/HeroSection";
import HowItWorks from "../components/landingpage/HowItWorks";
import AnimatedInventoryShowcase from "../components/landingpage/AnimatedList";
import WhyChooseUs from "../components/landingpage/WhyChooseUs";
import Testimonials from "../components/landingpage/Testimonials";
import Footer from "../components/landingpage/Footer";
import KeyFeatures from "../components/landingpage/KeyFeatures";
import { motion, useScroll, useSpring } from "framer-motion";
import { ArrowRight } from "lucide-react";


import { useNavigate } from "react-router-dom";

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });


  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);





  return (
    <div className="relative min-h-screen w-full bg-slate-50 selection:bg-emerald-500 selection:text-white overflow-x-hidden font-sans">

      {/* Scroll Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400 origin-left z-[60]"
        style={{ scaleX }}
      />




      {/* Navigation */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out border-b ${scrolled
          ? "bg-white/95 backdrop-blur-xl shadow-lg shadow-slate-200/50 border-slate-200/60"
          : "bg-white/80 backdrop-blur-md border-white/20"
          }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3 group relative z-10 cursor-pointer">
            <div className="w-32 mt-4 h-32 rounded-full -mr-10 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <img src="/logo.svg" className="w-full h-full object-contain" />
            </div>
            <span className="text-xl mb-1 sm:text-2xl font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent tracking-tight">
              SynapStore
            </span>
          </div>



          {/* CTA Button & Mobile Menu Toggle */}
          <div className="flex items-center gap-4">
            <motion.button
              onClick={() => navigate("/login")}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="group relative flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold text-sm shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-300 hover:-translate-y-0.5 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative z-10">Get Started</span>
              <ArrowRight className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition-transform duration-300" />
            </motion.button>
          </div>
        </div>
      </motion.nav>



      <main className="relative z-10 w-full">
        <HeroSection />

        <div className="bg-white relative">
          {/* Subtle separator gradient */}
          <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-slate-50 to-white pointer-events-none" />

          <KeyFeatures />
          <WhyChooseUs />
          <HowItWorks />
          <AnimatedInventoryShowcase />
          <Testimonials />
        </div>

        <Footer />
      </main>
    </div >
  );
};

export default LandingPage;
