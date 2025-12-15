import app from "./app";
import { ensureAdmin } from "./lib/init-admin";
import { Server } from "http";

const PORT = Number(process.env.PORT) || 3000;

let server: Server;

 server = app.listen(PORT, () => {
    console.log("\x1b[36m");
    console.log(`    ___________________________________________________ `);
    console.log(`   |                                                   |`);
    console.log(`   |   _   _   _   _   _   _   _   _   _   _   _   _   |`);
    console.log(`   |  / \\ / \\ / \\ / \\ / \\ / \\ / \\ / \\ / \\ / \\ / \\ / \\  |`);
    console.log(`   | ( S | Y | N | A | P | S | T | O | R | E | . |  ) |`);
    console.log(`   |  \\_/ \\_/ \\_/ \\_/ \\_/ \\_/ \\_/ \\_/ \\_/ \\_/ \\_/ \\_/  |`);
    console.log(`   |                                                   |`);
    console.log(`   |        >>> SYSTEM ONLINE :: PORT ${PORT} <<<         |`);
    console.log(`   |___________________________________________________|`);
    console.log("\x1b[0m");
    console.log(`\x1b[32m[INIT] Neural interfaces..................... CONNECTED\x1b[0m`);
    console.log(`\x1b[32m[INIT] Encryption protocols.................. ACTIVE\x1b[0m`);
    console.log(`\x1b[32m[INIT] Synapse core.......................... ONLINE\x1b[0m`);
  });



