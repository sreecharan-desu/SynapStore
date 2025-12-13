
import dotenv from "dotenv";
import path from "path";

// Load environment variables from the root of the backend
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { sendNotification } from "../lib/notification";

async function main() {
    // Check if a URL is provided in args, otherwise use default
    // Usage: npx ts-node scripts/test-notification.ts [URL]
    
    console.log("🚀 Starting Notification Test Script...");
    
    const serviceUrl = process.env.NOTIFICATION_SERVICE_URL || "https://notification-service-synapstore.vercel.app";
    console.log(`ℹ️  Service URL in env: ${serviceUrl}`);

    // Sample Payload using the interface defined in lib/notification.ts
    // The 'websiteUrl' is critical as it is used by the service to create the channel/stream ID
    const payload = {
        websiteUrl: "http://localhost:5173", // Target localhost client
        title: "Localhost Test �",
        message: `Hello localhost! Time: ${new Date().toLocaleTimeString()}`,
        image: "https://api.dicebear.com/7.x/thumbs/svg?seed=SynapStore", // Better test image
        buttons: [
            { label: "View Dashboard", link: "https://synapstore.dev/dashboard" },
            { label: "Dismiss", link: "https://synapstore.dev/dismiss" }
        ],
        metadata: {
            testRunId: Math.floor(Math.random() * 10000),
            triggeredBy: "manual_script"
        }
    };

    console.log("\n📦 Sending Payload:");
    console.log(JSON.stringify(payload, null, 2));

    try {
        const response = await sendNotification(payload);
        
        if (response) {
            console.log("\n✅ Test Passed! Response from Service:");
            console.log(JSON.stringify(response, null, 2));
        } else {
            console.log("\n❌ Test Failed: No response received (Check internal error logs)");
        }
    } catch (error) {
        console.error("\n❌ Unexpected script error:", error);
    }
}

main();
