import { Navigate } from "react-router-dom";
import { useAuthContext } from "./context/AuthContext";
import LandingPage from "./pages/LandingPage";
import { useEffect, useState } from "react";
import { SynapNotificationClient } from "./utils/NotificationClient";
import { NotificationToastContainer } from "./components/ui/NotificationToast";

const App = () => {
  const { user, isAuthenticated } = useAuthContext();
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    // Determine Service URL (Env Var > Default)
    // Defaulting to Production URL as Localhost is typically not running the microservice
    const SERVICE_URL = import.meta.env.VITE_NOTIFICATION_SERVICE_URL || "https://notification-service-synapstore.vercel.app";
    
    // Identifier: User ID if logged in, else Hostname
    // We append a pseudo-domain to the user ID to satisfy the Notification Service's URL validation
    // while ensuring the hostname matches for routing.
    const targetId = (isAuthenticated && user?.id) 
        ? `${user.id}.u.synapstore.com` 
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

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // If user is already logged in, send them to their specific dashboard
  const getRedirect = () => {
    if (isAuthenticated && user) {
        if (user.globalRole === "SUPERADMIN") return <Navigate to="/admin/dashboard" replace />;
        if (user.globalRole === "SUPPLIER") return <Navigate to="/supplier/dashboard" replace />;
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
