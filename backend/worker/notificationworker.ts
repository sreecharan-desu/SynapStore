import { createWorker } from "../lib/queue";
import { Job } from "bullmq";
import { sendNotification } from "../lib/notification";

export const worker = createWorker(async (job: Job) => {
  console.log(`\x1b[36m[Worker]\x1b[0m Processing job ${job.id} of type ${job.name}`);

  if (job.name === "send-notification") {
    try {
      await sendNotification(job.data);
      console.log(`\x1b[36m[Worker]\x1b[0m Notification sent for job ${job.id}`);
    } catch (err: any) {
      console.error(`\x1b[36m[Worker]\x1b[0m Failed to send notification: ${err.message}`);
      throw err;
    }
  }
}, 5, false); // autorun: false

export const startWorker = async () => {
    if (!worker.isRunning()) {
        console.log("\x1b[36m[Worker]\x1b[0m Starting manually...");
        // In persistent mode, we don't await run() because it blocks until closed
        worker.run().catch(e => console.error(e)); 
    }
};

export const processAndDrain = async () => {
    console.log("\x1b[36m[Worker]\x1b[0m Starting to process batch...");
    if (!worker.isRunning()) {
        worker.run().catch(e => console.error(e));
    }
    
    return new Promise<void>((resolve) => {
        const handler = async () => {
            console.log("\x1b[36m[Worker]\x1b[0m Queue drained. Closing...");
            await worker.close();
            worker.off('drained', handler);
            resolve();
        };
        worker.on('drained', handler);
    });
};

worker.on("completed", (job) => {
  console.log(`\x1b[36m[Worker]\x1b[0m Job ${job.id} \x1b[32mcompleted!\x1b[0m`);
});

worker.on("failed", (job, err) => {
  console.error(`\x1b[36m[Worker]\x1b[0m Job ${job?.id} \x1b[31mfailed:\x1b[0m ${err.message}`);
});
