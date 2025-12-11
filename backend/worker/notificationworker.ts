import { createWorker } from "../lib/queue";
import { Job } from "bullmq";
import { sendNotification } from "../lib/notification";

export const worker = createWorker(async (job: Job) => {
  console.log(`[Worker] Processing job ${job.id} of type ${job.name}`);

  if (job.name === "send-notification") {
    try {
      await sendNotification(job.data);
      console.log(`[Worker] Notification sent for job ${job.id}`);
    } catch (err: any) {
      console.error(`[Worker] Failed to send notification: ${err.message}`);
      throw err;
    }
  }
}, 5);

worker.on("completed", (job) => {
  console.log(`[Worker] Job ${job.id} completed!`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} has failed with ${err.message}`);
});
