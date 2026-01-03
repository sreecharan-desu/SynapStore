import { Navigate } from "react-router-dom";
import { useAuthContext } from "./context/AuthContext";
import LandingPage from "./pages/LandingPage";
import { useEffect, useState } from "react";
// import { SynapNotificationClient } from "./utils/NotificationClient";
import { NotificationToastContainer } from "./components/ui/NotificationToast";
import toast from "react-hot-toast";

const App = () => {
  const { user, isAuthenticated } = useAuthContext();
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    // Super Strict Tamper Detection
    // We monkey-patch setItem/removeItem to track legitimate app updates.
    // Any change detected via polling that wasn't flagged as 'app-initiated' is treated as tampering.

    let lastKnownValue = localStorage.getItem("synapstore:auth");
    let isAppInitiated = false;

    // Monkey-patch setItem
    const originalSetItem = window.localStorage.setItem;
    window.localStorage.setItem = function(key, value) {
      if (key === "synapstore:auth") {
        isAppInitiated = true;
        lastKnownValue = value; 
      }
      originalSetItem.apply(this, [key, value]);
      if (key === "synapstore:auth") isAppInitiated = false;
    };

    // Monkey-patch removeItem
    const originalRemoveItem = window.localStorage.removeItem;
    window.localStorage.removeItem = function(key) {
      if (key === "synapstore:auth") {
        isAppInitiated = true;
        lastKnownValue = null;
      }
      originalRemoveItem.apply(this, [key]);
      if (key === "synapstore:auth") isAppInitiated = false;
    };

    // Polling interval to detect DevTools/External changes
    const intervalId = setInterval(() => {
      const currentValue = localStorage.getItem("synapstore:auth");
      
      if (currentValue !== lastKnownValue) {
        if (!isAppInitiated) {
          console.warn("Strict Tamper Detection: Storage changed without app initiation!");
          toast.error("Security Alert: Storage tampering detected. Logging out.");
          
          // Force Clean
          originalRemoveItem.apply(window.localStorage, ["synapstore:auth"]);
          document.cookie = "synapstore:auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
          
          window.location.href = "/";
        } else {
          lastKnownValue = currentValue;
        }
      }
    }, 1000); 

    return () => {
      clearInterval(intervalId);
      // Restore originals
      window.localStorage.setItem = originalSetItem;
      window.localStorage.removeItem = originalRemoveItem;
    };
  }, []);








  /* 
  // Backend interactions disabled for static demo
  useEffect(() => {
    // Determine Service URL (Env Var > Default)
    // Defaulting to Production URL as Localhost is typically not running the microservice
    const SERVICE_URL = import.meta.env.VITE_NOTIFICATION_SERVICE_URL || "https://notification-service-synapstore.vercel.app";

    // Identifier: User ID if logged in, else Hostname
    // Using /u/:userId as a stable, domain-based notification channel to match backend
    // Normalize URL to remove trailing slash
    const rawUrl = import.meta.env.VITE_FRONTEND_URL || window.location.origin;
    const FRONTEND_URL = rawUrl.replace(/\/$/, "");

    const targetId = (isAuthenticated && user?.id)
      ? `${FRONTEND_URL}/u/${user.id}`
      : window.location.hostname;

    // Default true if not explicitly set to false
    const shouldEnable = import.meta.env.VITE_ENABLE_NOTIFICATIONS !== "false";

    if (shouldEnable) {
      const client = new SynapNotificationClient(targetId, SERVICE_URL);

      client.onNotification((data: any) => {
        console.log("Recv Notification:", data);
        const newNotif = {
          id: Date.now().toString(),
          title: data.title || "Notification",
          message: data.message || "",
          image: data.image,
          link: data.link || (data.buttons && data.buttons[0]?.link),
          timestamp: Date.now()
        };
        setNotifications(prev => [newNotif, ...prev]);

        // Auto dismiss after 5s
        setTimeout(() => {
          setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
        }, 5000);
      });

      // Request Background Permission
      client.enablePushNotifications();

      return () => {
        client.disconnect();
      }
    }
  }, [isAuthenticated, user?.id]);
  */

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // If user is already logged in, send them to their specific dashboard
  const getRedirect = () => {
    if (isAuthenticated && user) {
      if (user.globalRole === "SUPERADMIN") return <Navigate to="/admin/dashboard" replace />;
      if (user.globalRole === "SUPPLIER") return <Navigate to="/supplier/dashboard" replace />;
      if (user.globalRole === "READ_ONLY") return <Navigate to="/store/dashboard" replace />;
      return <Navigate to="/store/dashboard" replace />;
    }
    return <LandingPage />;
  };

  return (
    <>
      {getRedirect()}
      <NotificationToastContainer notifications={notifications} onDismiss={dismissNotification} />
    </>
  );
};

export default App;
