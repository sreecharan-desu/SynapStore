import axios from "axios";

const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || "https://notification-service-synapstore.vercel.app";

interface NotificationButton {
  label: string;
  link: string;
}

interface NotifyPayload {
  websiteUrl: string; // Used to identify the target/user
  title: string;
  message: string;
  image?: string;
  buttons?: NotificationButton[];
  metadata?: Record<string, any>;
}

/**
 * Sends a real-time notification via the Notification Microservice.
 * This triggers both In-App SSE and Web Push.
 */
export async function sendNotification(payload: NotifyPayload) {
  try {
    const response = await axios.post(`${NOTIFICATION_SERVICE_URL}/notify`, payload, {
      headers: { "Content-Type": "application/json" }
    });
    
    // console.log("[Notification] Sent successfully:", response.data.data?.id);
    return response.data;
  } catch (error: any) {
    console.error("[Notification] Failed to send:", error.message);
    // Silent fail - don't block main flow if notification service is down
    return null;
  }
}
