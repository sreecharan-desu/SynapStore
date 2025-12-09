import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";

const reviews = [
  {
    name: "Dr. Sarah Johnson",
    role: "Pharmacy Manager, HealthPlus",
    body: "SynapStore has transformed our inventory management. We've reduced stockouts by 75% and improved our order accuracy to 99.9%.",
    rating: 5,
    img: "https://randomuser.me/api/portraits/women/44.jpg",
  },
  {
    name: "Michael Chen",
    role: "Owner, Downtown Pharmacy",
    body: "The real-time tracking and automated alerts have saved us countless hours. Our team is more efficient and our customers are happier.",
    rating: 5,
    img: "https://randomuser.me/api/portraits/men/32.jpg",
  },
  {
    name: "Priya Patel",
    role: "Pharmacist, MediCare",
    body: "Integration with our existing systems was seamless. The support team was incredibly helpful throughout the process.",
    rating: 4,
    img: "https://randomuser.me/api/portraits/women/68.jpg",
  },
  {
    name: "Robert Wilson",
    role: "Operations Director, PharmaChain",
    body: "The analytics dashboard provides insights we never had before. We've optimized our inventory levels and reduced waste significantly.",
    rating: 5,
    img: "https://randomuser.me/api/portraits/men/75.jpg",
  },
];

// Animation variants
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.2,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  hover: {
    y: -5,
    transition: { duration: 0.2 },
  },
};

const ReviewCard = ({
  img,
  name,
  role,
  body,
  rating,
  variants = item,
}: {
  img: string;
  name: string;
  role: string;
  body: string;
  rating: number;
  variants?: any;
}) => {
  return (
    <motion.div
      variants={variants}
      initial="hidden"
      whileInView="show"
      whileHover="hover"
      viewport={{ once: true, margin: "-100px 0px" }}
      className="h-full"
    >
      <div className="h-full bg-white/60 backdrop-blur-lg rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-white/40 overflow-hidden flex flex-col ring-1 ring-white/50">
        <div className="p-6 flex-1">
          <div className="flex items-center gap-3 mb-4">
            <img
              className="w-12 h-12 rounded-full object-cover border-2 border-white/60 shadow-sm"
              src={img}
              alt={name}
            />
            <div>
              <h4 className="font-medium text-brand-text">{name}</h4>
              <p className="text-sm text-brand-text-muted">{role}</p>
            </div>
          </div>

          <div className="flex items-center mb-3">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-4 h-4 ${i < rating ? "text-brand-highlight fill-current" : "text-brand-border"
                  }`}
              />
            ))}
          </div>

          <blockquote className="text-brand-text-muted text-sm leading-relaxed">
            "{body}"
          </blockquote>
        </div>

        <div className="px-6 py-4 bg-white/40 border-t border-white/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand-pale flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-brand-primary"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <span className="text-sm text-brand-text-muted">Verified User</span>
            </div>
            <div className="text-xs text-brand-text-muted/60">2 days ago</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export function Testimonials() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.1 });
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);

    const handleChange = () => setReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return (
    <section className="py-24 bg-background-page relative overflow-hidden" id="testimonials">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-20 left-10 w-64 h-64 bg-brand-primary/5 rounded-full blur-[80px]" />
      </div>
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView || reducedMotion ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Trusted by Pharmacy Professionals
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Join thousands of pharmacies that have transformed their inventory
            management with SynapStore
          </p>
        </motion.div>

        <motion.div
          ref={ref}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px 0px" }}
        >
          {reviews.map((review, index) => (
            <ReviewCard
              key={`${review.name}-${index}`}
              {...review}
              variants={{
                ...item,
                hidden: { opacity: 0, y: 30 },
                show: {
                  opacity: 1,
                  y: 0,
                  transition: {
                    delay: index * 0.1,
                    duration: 0.6,
                    ease: [0.16, 1, 0.3, 1],
                  },
                },
                hover: {
                  y: -5,
                  transition: { duration: 0.2 },
                },
              }}
            />
          ))}
        </motion.div>

        <motion.div
          className="mt-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView || reducedMotion ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          <p className="text-sm text-gray-500 mb-6">
            Join our growing community of satisfied customers
          </p>

        </motion.div>
      </div>
    </section>
  );
}

export default Testimonials;
