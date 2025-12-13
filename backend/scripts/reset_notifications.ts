
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || "https://notification-service-synapstore.vercel.app";

async function resetNotificationService() {
  console.log(`[Reset] Attempting to clear subscriptions at ${NOTIFICATION_SERVICE_URL}...`);
  try {
    // Attempting a standard RESTful clear/reset endpoint
    // The user will need to implement this on their service if not present
    const res = await axios.post(`${NOTIFICATION_SERVICE_URL}/internal/reset`, {}, {
        headers: {
            "Content-Type": "application/json",
            // "x-admin-secret": process.env.ADMIN_SECRET // Recommended for security
        }
    });
    console.log("[Reset] Success:", res.data);
  } catch (error: any) {
    if (error.response) {
        console.error(`[Reset] Failed with status ${error.response.status}: ${error.response.data}`);
        if (error.response.status === 404) {
             console.log("\n⚠️  Endpoint /internal/reset not found on notification service.");
             console.log("   Please implement a POST /internal/reset endpoint on your microservice to clear the database.");
        }
    } else {
        console.error("[Reset] Network/Server Error:", error.message);
    }
  }
}

resetNotificationService();
