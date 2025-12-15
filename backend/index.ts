import app from "./app";
import { ensureAdmin } from "./lib/init-admin";
import { Server } from "http";

const PORT = Number(process.env.PORT) || 3000;

let server: Server;

 server = app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
  });



