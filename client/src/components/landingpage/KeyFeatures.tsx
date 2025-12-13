import { StickyScroll } from "../ui/sticky-scroll-reveal";

const content = [
  {
    title: "Real-Time Inventory Tracking",
    description:
      "Track every medicine movement instantly with barcode scanning and RFID technology. Get accurate stock levels across all locations in real-time. Our system ensures you never lose sight of your inventory, providing peace of mind and operational efficiency.",
    content: (
      <div className="h-full w-full flex items-center justify-center text-white relative overflow-hidden rounded-2xl">
        <img
          src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=2070&auto=format&fit=crop"
          className="h-full w-full object-cover"
          alt="Inventory Tracking"
        />
        <div className="absolute inset-0 bg-black/10" />
      </div>
    ),
  },
  {
    title: "Smart Alerts & Notifications",
    description:
      "Automatic notifications when stock falls below critical levels, medicines are expiring, or when it's time to reorder. Stay ahead of supply chain issues and prevent stockouts before they affect your patients.",
    content: (
      <div className="h-full w-full flex items-center justify-center text-white relative overflow-hidden rounded-2xl">
        <img
          src="https://images.unsplash.com/photo-1555774698-0b77e0d5fac6?q=80&w=2070&auto=format&fit=crop"
          className="h-full w-full object-cover"
          alt="Smart Alerts"
        />
        <div className="absolute inset-0 bg-black/10" />
      </div>
    ),
  },
  {
    title: "Advanced Analytics",
    description:
      "Comprehensive reports and insights on inventory patterns, sales trends, and stock turnover. Make data-driven decisions to optimize your purchasing and reduce waste. Visualize your pharmacy's performance like never before.",
    content: (
      <div className="h-full w-full flex items-center justify-center text-white relative overflow-hidden rounded-2xl">
        <img
          src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop"
          className="h-full w-full object-cover"
          alt="Analytics"
        />
        <div className="absolute inset-0 bg-black/10" />
      </div>
    ),
  },
  {
    title: "HIPAA Compliant & Secure",
    description:
      "Enterprise-grade security with encryption, regular backups, and compliance with healthcare regulations. Your data (and your patients' data) is safe, protected, and private at all times.",
    content: (
      <div className="h-full w-full flex items-center justify-center text-white relative overflow-hidden rounded-2xl">
        <img
          src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=2070&auto=format&fit=crop"
          className="h-full w-full object-cover"
          alt="Security"
        />
        <div className="absolute inset-0 bg-black/10" />
      </div>
    ),
  },
  {
    title: "Lightning Fast Performance",
    description:
      "Built for speed with instant search, quick barcode scanning, and seamless multi-user access. Designed to keep up with the fast-paced environment of modern pharmacies without slowing you down.",
    content: (
      <div className="h-full w-full flex items-center justify-center text-white relative overflow-hidden rounded-2xl">
        <img
          src="https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=2070&auto=format&fit=crop"
          className="h-full w-full object-cover"
          alt="Performance"
        />
        <div className="absolute inset-0 bg-black/10" />
      </div>
    ),
  },
  {
    title: "Multi-Location Support",
    description:
      "Manage inventory across multiple pharmacy locations from a single dashboard. Transfer stock between locations easily and get a unified view of your entire organization's inventory health.",
    content: (
      <div className="h-full w-full flex items-center justify-center text-white relative overflow-hidden rounded-2xl">
        <img
          src="https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=2070&auto=format&fit=crop"
          className="h-full w-full object-cover"
          alt="Multi-Location"
        />
        <div className="absolute inset-0 bg-black/10" />
      </div>
    ),
  },
];

const KeyFeatures = () => {
  return (
    <section id="features" className="pt-24 pb-0 relative bg-background-page">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-border to-transparent" />

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-40 left-0 w-96 h-96 bg-brand-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-40 right-0 w-96 h-96 bg-brand-highlight/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-brand-text mb-6">
            Everything you need to manage inventory
          </h2>
          <p className="text-xl text-brand-text-muted max-w-2xl mx-auto">
            Powerful features designed for modern pharmacies
          </p>
        </div>

        <StickyScroll content={content} />
      </div>
    </section>
  );
};

export default KeyFeatures;
