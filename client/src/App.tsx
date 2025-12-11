import { Navigate } from "react-router-dom";
import { useAuthContext } from "./auth/AuthContext";
import LandingPage from "./pages/LandingPage";
import { useEffect } from "react";
import { SynapNotificationClient } from "./utils/NotificationClient";

const App = () => {
  useEffect(() => {
    // Determine Service URL (Env Var > Default)
    const SERVICE_URL = import.meta.env.VITE_NOTIFICATION_SERVICE_URL || "http://localhost:4000";
    
    // Identifier: Hostname
    const targetId = window.location.hostname; // e.g., localhost or my-site.com
    
    if (import.meta.env.VITE_ENABLE_NOTIFICATIONS === "true") {
      const client = new SynapNotificationClient(targetId, SERVICE_URL);
      
      client.onNotification((data: any) => {
        console.log("Recv Notification:", data);
        // Only using system notifications now (handled by sw.js)
      });
      
      // Request Background Permission
      client.enablePushNotifications();
    }
  }, []);

  const { user, isAuthenticated } = useAuthContext();

  // If user is already logged in, send them to their specific dashboard
  if (isAuthenticated && user) {
    if (user.globalRole === "SUPERADMIN") {
      return <Navigate to="/admin/dashboard" replace />;
    } else if (user.globalRole === "SUPPLIER") {
      return <Navigate to="/supplier/dashboard" replace />;
    } else {
      // STORE_OWNER, USER, MANAGER -> Store Dashboard
      return <Navigate to="/store/dashboard" replace />;
    }
  }

  return <LandingPage />;
};

export default App;
