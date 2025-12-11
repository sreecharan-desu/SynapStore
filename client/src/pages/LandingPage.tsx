import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import HeroSection from "../components/landingpage/HeroSection";
import HowItWorks from "../components/landingpage/HowItWorks";
import AnimatedInventoryShowcase from "../components/landingpage/AnimatedList";
import WhyChooseUs from "../components/landingpage/WhyChooseUs";
import Testimonials from "../components/landingpage/Testimonials";
import Footer from "../components/landingpage/Footer";
import KeyFeatures from "../components/landingpage/KeyFeatures";
import { motion, useScroll, useSpring, AnimatePresence } from "framer-motion";
import { ArrowRight, Menu, Package, X } from "lucide-react";

const LandingPage: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu when clicking outside
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen]);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 80; // Account for fixed navbar
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
      setMobileMenuOpen(false);
    }
  };

  const navLinks: any[] = [];

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
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out border-b ${
          scrolled
            ? "bg-white/95 backdrop-blur-xl shadow-lg shadow-slate-200/50 border-slate-200/60"
            : "bg-white/80 backdrop-blur-md border-white/20"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3 group relative z-10 cursor-pointer">
            <div className="w-38 h-38 mt-5 -mr-12 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <img src="/logo.svg"/>
            </div>
            <span className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent tracking-tight">
              SynapStore
            </span>
          </div>

 

          {/* CTA Button & Mobile Menu Toggle */}
          <div className="flex items-center gap-4">
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="group relative flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold text-sm shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-300 hover:-translate-y-0.5 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative z-10">Get Started</span>
              <ArrowRight className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition-transform duration-300" />
            </motion.button>

            {/* Mobile Menu Button */}
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors duration-300"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 text-slate-700" />
              ) : (
                <Menu className="w-5 h-5 text-slate-700" />
              )}
            </motion.button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden"
                onClick={() => setMobileMenuOpen(false)}
              />

              <motion.div
                initial={{ opacity: 0, x: "100%" }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: "100%" }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="fixed top-20 right-0 bottom-0 w-72 bg-white/95 backdrop-blur-xl shadow-2xl z-50 md:hidden border-l border-slate-200"
              >
                <div className="flex flex-col p-6 gap-2">
                  {navLinks.map((link, index) => (
                    <motion.button
                      key={link.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      onClick={() => scrollToSection(link.id)}
                      className="w-full text-left px-4 py-3 text-slate-700 font-medium rounded-lg hover:bg-emerald-50 hover:text-emerald-600 transition-all duration-300"
                    >
                      {link.label}
                    </motion.button>
                  ))}

                  <motion.button
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: navLinks.length * 0.1 }}
                    onClick={() => setMobileMenuOpen(false)}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-300"
                  >
                    <span>Get Started</span>
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
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
    </div>
  );
};

export default LandingPage;
