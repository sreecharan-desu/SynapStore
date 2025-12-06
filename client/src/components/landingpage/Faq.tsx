import { ChevronDown, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";

const faqsData = [
  {
    question: "How does SynapStore track inventory in real-time?",
    answer:
      "SynapStore uses advanced barcode scanning and RFID technology to track every medicine movement instantly. Our system updates inventory levels across all locations in real-time, ensuring you always have accurate stock information.",
  },
  {
    question:
      "Can I integrate SynapStore with my existing pharmacy management system?",
    answer:
      "Yes! SynapStore offers robust API integrations with major pharmacy management systems, POS systems, and accounting software. Our team can help you set up seamless data synchronization.",
  },
  {
    question: "What happens when stock levels get low?",
    answer:
      "SynapStore automatically sends smart alerts via email, SMS, or in-app notifications when medicines approach reorder points. You can customize alert thresholds for each product and set up automatic reorder suggestions.",
  },
  {
    question: "Is my pharmacy data secure?",
    answer:
      "Absolutely. We use enterprise-grade encryption, comply with HIPAA regulations, and maintain SOC 2 Type II certification. Your data is stored securely and backed up daily with 99.9% uptime guarantee.",
  },
  {
    question: "How long does it take to set up SynapStore?",
    answer:
      "Most pharmacies are up and running within 24-48 hours. Our onboarding team helps you import existing inventory, set up alerts, and train your staff. No technical expertise required.",
  },
  {
    question: "Can I track multiple pharmacy locations?",
    answer:
      "Yes! SynapStore supports multi-location inventory management. Track stock across all your branches, transfer medicines between locations, and get consolidated reports for your entire pharmacy network.",
  },
];

const Faq = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // staggered entrance animation control
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Animation variants for staggered children
  const container: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
  };

  const item: Variants = {
    hidden: { opacity: 0, y: 10 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: [0.2, 0.8, 0.2, 1] as any,
      },
    },
  };

  return (
    <section
      id="faq"
      className="relative py-20 bg-linear-to-b from-slate-50 to-white overflow-hidden"
    >
      {/* Header */}
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-3">
            Frequently asked questions
          </h2>
          <p className="text-lg md:text-xl text-slate-600">
            Everything you need to know about{" "}
            <span className="font-semibold text-emerald-600">SynapStore</span>
          </p>
        </div>

        {/* FAQ list with staggered animations */}
        <motion.div
          className="space-y-4"
          variants={container}
          initial="hidden"
          animate={mounted ? "show" : "hidden"}
        >
          {faqsData.map((faq, index) => {
            const isOpen = openFaq === index;
            const delayMs = 40 * index;

            return (
              <motion.article
                variants={item}
                layout="position"
                key={index}
                aria-labelledby={`faq-${index}-title`}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border transition-all duration-300",
                  "bg-white/80 backdrop-blur-sm border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5",
                  isOpen ? "ring-2 ring-blue-500/20" : ""
                )}
                style={{
                  // staggered entrance
                  transform: mounted ? "none" : "translateY(10px)",
                  opacity: mounted ? 1 : 0,
                  transition: `opacity 420ms cubic-bezier(.2,.9,.3,1) ${delayMs}ms, transform 420ms cubic-bezier(.2,.9,.3,1) ${delayMs}ms`,
                }}
              >
                <header>
                  <button
                    id={`faq-${index}-title`}
                    aria-expanded={isOpen}
                    aria-controls={`faq-${index}-panel`}
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="w-full px-6 py-5 flex items-start gap-4 justify-between text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    <div>
                      <h3 className="text-base md:text-lg font-semibold text-slate-900 leading-tight">
                        {faq.question}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500 hidden md:block">
                        {faq.answer.slice(0, 75)}
                        {faq.answer.length > 75 ? "…" : ""}
                      </p>
                    </div>

                    <div className="ml-4 flex items-center">
                      <span
                        className={cn(
                          "mr-3 text-xs px-2 py-1 rounded-full font-medium",
                          isOpen
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            : "bg-slate-50 text-slate-600 border border-slate-100"
                        )}
                      >
                        {isOpen ? "Open" : "Info"}
                      </span>

                      <motion.div
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{
                          duration: 0.3,
                          type: "spring",
                          stiffness: 300,
                          damping: 20,
                        }}
                      >
                        <ChevronDown
                          className={cn(
                            "w-5 h-5 shrink-0 transition-colors duration-200",
                            isOpen
                              ? "text-blue-600"
                              : "text-slate-500 group-hover:text-blue-500"
                          )}
                          aria-hidden
                        />
                      </motion.div>
                    </div>
                  </button>
                </header>

                {/* Animated panel */}
                <motion.div
                  id={`faq-${index}-panel`}
                  role="region"
                  aria-labelledby={`faq-${index}-title`}
                  className="px-6 overflow-hidden"
                  initial={false}
                  animate={{
                    height: isOpen ? "auto" : 0,
                    opacity: isOpen ? 1 : 0,
                    y: isOpen ? 0 : -10,
                  }}
                  transition={{
                    duration: 0.3,
                    ease: [0.2, 0.8, 0.2, 1],
                  }}
                >
                  <div className="py-4 pb-6 md:pb-8">
                    <motion.p
                      className="text-sm md:text-base text-slate-600 leading-relaxed"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: isOpen ? 1 : 0 }}
                      transition={{ delay: 0.1, duration: 0.2 }}
                    >
                      {faq.answer}
                    </motion.p>

                    {/* CTA row with improved buttons */}
                    <motion.div
                      className="mt-6 flex flex-wrap items-center gap-4"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{
                        opacity: isOpen ? 1 : 0,
                        y: isOpen ? 0 : 10,
                        transition: { delay: 0.15 },
                      }}
                    >
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="group relative inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-linear-to-r from-blue-600 to-blue-700 text-white text-sm font-medium shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden"
                        onClick={() => {
                          window?.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        <span className="relative z-10">
                          Learn how it works
                        </span>
                        <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                        <span className="absolute inset-0 bg-linear-to-r from-blue-700 to-blue-800 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                      </motion.button>

                      <motion.button
                        whileHover={{ x: 2 }}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1 group"
                        onClick={() => {
                          window?.scrollTo({
                            top: document.body.scrollHeight,
                            behavior: "smooth",
                          });
                        }}
                      >
                        Contact support
                        <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                      </motion.button>
                    </motion.div>
                  </div>
                </motion.div>

                {/* subtle focus ring for keyboard users */}
                <motion.div
                  className="absolute inset-x-6 bottom-0 h-0 pointer-events-none"
                  aria-hidden
                />
              </motion.article>
            );
          })}
        </motion.div>
      </div>

      {/* Inline CSS to honor reduced motion for users who prefer it */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .group * {
            transition: none !important;
            animation: none !important;
          }
        }
      `}</style>
    </section>
  );
};

export default Faq;
