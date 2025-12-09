import "dotenv/config"; // Ensure env vars are loaded first
import { worker } from "./worker/notificationworker";

console.log("Starting notification worker...");

// Keep process alive
process.on("SIGINT", async () => {
  console.log("Shutting down worker...");
  await worker.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Shutting down worker...");
  await worker.close();
  process.exit(0);
});
