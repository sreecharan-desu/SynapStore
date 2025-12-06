import { useNavigate } from "react-router-dom";
import { removeCookie } from "../utils/cookieUtils";

const Home = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Clear all cookies
    document.cookie.split(";").forEach((c) => {
      const cookieName = c.split("=")[0].trim();
      if (cookieName) {
        removeCookie(cookieName);
      }
    });
    // Navigate to login and refresh
    navigate("/login");
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-blue-50">
      {/* Header/Navbar */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">💊</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">SynapStore</h1>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            Smart Pharmacy Inventory Management System
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Streamline your pharmacy operations with intelligent inventory
            tracking, automated alerts, and real-time analytics.
          </p>
          <div className="flex gap-4 justify-center">
            <button className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition">
              Get Started
            </button>
            <button className="px-8 py-3 border border-blue-600 text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition">
              Learn More
            </button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white rounded-lg shadow-md p-8 hover:shadow-lg transition">
            <div className="text-4xl mb-4">📦</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Inventory Tracking
            </h3>
            <p className="text-gray-600">
              Real-time tracking of stock levels across all your pharmacy
              locations.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8 hover:shadow-lg transition">
            <div className="text-4xl mb-4">🔔</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Smart Alerts
            </h3>
            <p className="text-gray-600">
              Automatic notifications when stock falls below critical levels.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8 hover:shadow-lg transition">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Analytics
            </h3>
            <p className="text-gray-600">
              Comprehensive reports and insights on inventory patterns and
              trends.
            </p>
          </div>
        </div>

        {/* Stats Section */}
        <div className="bg-white rounded-lg shadow-md p-12 mb-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-blue-600 mb-2">10K+</div>
              <p className="text-gray-600">Medicines Tracked</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-blue-600 mb-2">500+</div>
              <p className="text-gray-600">Pharmacies</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-blue-600 mb-2">99.9%</div>
              <p className="text-gray-600">Uptime</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-blue-600 mb-2">24/7</div>
              <p className="text-gray-600">Support</p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-linear-to-r from-blue-600 to-blue-700 rounded-lg p-12 text-center text-white">
          <h3 className="text-3xl font-bold mb-4">
            Ready to transform your pharmacy?
          </h3>
          <p className="text-lg mb-8 opacity-90">
            Join thousands of pharmacies already using SynapStore
          </p>
          <button className="px-8 py-3 bg-white text-blue-600 rounded-lg font-medium hover:bg-gray-100 transition">
            Start Free Trial
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p>&copy; 2025 SynapStore. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
