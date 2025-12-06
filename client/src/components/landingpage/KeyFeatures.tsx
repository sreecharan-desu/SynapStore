import { BarChart3, Bell, Package, Shield, Users, Zap } from "lucide-react";

const KeyFeatures = () => {
  return (
    <section id="features" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Everything you need to manage inventory
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Powerful features designed for modern pharmacies
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="bg-linear-to-br from-blue-50 to-blue-100 rounded-2xl p-8 hover:shadow-xl transition">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-6">
              <Package className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              Real-Time Inventory Tracking
            </h3>
            <p className="text-gray-700 leading-relaxed">
              Track every medicine movement instantly with barcode scanning and
              RFID technology. Get accurate stock levels across all locations in
              real-time.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-linear-to-br from-emerald-50 to-emerald-100 rounded-2xl p-8 hover:shadow-xl transition">
            <div className="w-12 h-12 bg-emerald-600 rounded-lg flex items-center justify-center mb-6">
              <Bell className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              Smart Alerts & Notifications
            </h3>
            <p className="text-gray-700 leading-relaxed">
              Automatic notifications when stock falls below critical levels,
              medicines are expiring, or when it's time to reorder. Customize
              alerts for each product.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-linear-to-br from-purple-50 to-purple-100 rounded-2xl p-8 hover:shadow-xl transition">
            <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center mb-6">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              Advanced Analytics
            </h3>
            <p className="text-gray-700 leading-relaxed">
              Comprehensive reports and insights on inventory patterns, sales
              trends, and stock turnover. Make data-driven decisions with visual
              dashboards.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="bg-linear-to-br from-orange-50 to-orange-100 rounded-2xl p-8 hover:shadow-xl transition">
            <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center mb-6">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              HIPAA Compliant & Secure
            </h3>
            <p className="text-gray-700 leading-relaxed">
              Enterprise-grade security with encryption, regular backups, and
              compliance with healthcare regulations. Your data is safe and
              protected.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="bg-linear-to-br from-pink-50 to-pink-100 rounded-2xl p-8 hover:shadow-xl transition">
            <div className="w-12 h-12 bg-pink-600 rounded-lg flex items-center justify-center mb-6">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              Lightning Fast Performance
            </h3>
            <p className="text-gray-700 leading-relaxed">
              Built for speed with instant search, quick barcode scanning, and
              seamless multi-user access. Handle high transaction volumes
              without slowdowns.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="bg-linear-to-br from-cyan-50 to-cyan-100 rounded-2xl p-8 hover:shadow-xl transition">
            <div className="w-12 h-12 bg-cyan-600 rounded-lg flex items-center justify-center mb-6">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              Multi-Location Support
            </h3>
            <p className="text-gray-700 leading-relaxed">
              Manage inventory across multiple pharmacy locations from a single
              dashboard. Transfer stock between locations and get consolidated
              reports.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default KeyFeatures;
