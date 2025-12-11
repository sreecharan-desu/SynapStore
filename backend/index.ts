import app from "./app";
import { ensureAdmin } from "./lib/init-admin";
import { Server } from "http";

const PORT = Number(process.env.PORT) || 3000;

let server: Server;

ensureAdmin().then(() => {
  server = app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
  });
});

// Graceful shutdown
const shutdown = () => {
  console.log("Shutting down server...");
  if (server) {
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
