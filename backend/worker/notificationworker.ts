
import { createWorker } from "../lib/queue";
import { Job } from "bullmq";

export const worker = createWorker(async (job: Job) => {
  console.log("Processing notification job:", job.id);
  // Placeholder: Add logic to handle 'EMAIL' or 'IN_APP' notifications
  // e.g. using sendMail(job.data)
}, 1);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} has completed!`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} has failed with ${err.message}`);
});
