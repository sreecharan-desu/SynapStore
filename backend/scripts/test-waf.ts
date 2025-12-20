import axios from 'axios';

const TARGET = process.env.WAF_TARGET || 'https://synapstore.me';

// ANSI colors
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function printBanner() {
    console.log(`${CYAN}
 -------------------------------------------------------------------------------------------------
 |                                                                                               |
 |     / \\     / \\     / \\     / \\     / \\     / \\     / \\     / \\     / \\     / \\     / \\       |
 |    ( S )   ( Y )   ( N )   ( A )   ( P )   ( S )   ( T )   ( O )   ( R )   ( E )   ( . )      |
 |     \\ /     \\ /     \\ /     \\ /     \\ /     \\ /     \\ /     \\ /     \\ /     \\ /     \\ /       |
 |                                                                                               |
 |                  >>>  WAF DEFENSE SYSTEM TEST  ::  TARGET: ${TARGET}  <<<                   |
 |                                                                                               |
 -------------------------------------------------------------------------------------------------
${RESET}`);
}

async function testSQLInjection() {
    const label = "SQL INJECTION";
    const attack = "?q=union+select";
    const url = `${TARGET}/${attack}`;

    process.stdout.write(`${BOLD}[TEST] ${label.padEnd(25)} :: ${RESET}`); // Start line

    try {
        const res = await axios.get(url, { validateStatus: () => true });
        if (res.status === 403 || res.status === 406 || res.status === 502) {
            // 502 might be WAF blocking upstream
            console.log(`${GREEN}✅  BLOCKED (${res.status})${RESET}`);
        } else if (res.status === 200) {
            console.log(`${RED}❌  FAILED (Allowed - 200)${RESET}`);
        } else {
            console.log(`${YELLOW}⚠️  UNCERTAIN (${res.status})${RESET}`);
        }
        console.log(`       Attack: Attempting query '${attack}'`);
        if (res.status !== 403 && res.status !== 406) console.log(`       Response was not a standard block code.`);

    } catch (error: any) {
        console.log(`${RED}ERROR: ${error.message}${RESET}`);
    }
}

async function testBadBot() {
    const label = "BAD BOT AGENT";
    const userAgent = "sqlmap"; // Common blocked UA

    process.stdout.write(`${BOLD}[TEST] ${label.padEnd(25)} :: ${RESET}`);

    try {
        const res = await axios.get(`${TARGET}`, {
            headers: { 'User-Agent': userAgent },
            validateStatus: () => true
        });

        if (res.status === 403 || res.status === 406) {
            console.log(`${GREEN}✅  BLOCKED (${res.status})${RESET}`);
        } else if (res.status === 200) {
            console.log(`${RED}❌  FAILED (Allowed - 200)${RESET}`);
        } else {
            console.log(`${YELLOW}⚠️  UNCERTAIN (${res.status})${RESET}`);
        }
        console.log(`       Attack: Spoofing User-Agent as '${userAgent}'`);

    } catch (error: any) {
        console.log(`${RED}ERROR: ${error.message}${RESET}`);
    }
}

async function testAdminAccess() {
    const label = "ADMIN ACCESS";
    const path = "api/v1/admin";

    process.stdout.write(`${BOLD}[TEST] ${label.padEnd(25)} :: ${RESET}`);

    try {
        // Expecting 403 or 401, but WAF might return 403 for specific patterns
        // Assuming simple access without creds
        const res = await axios.get(`${TARGET}/${path}`, { validateStatus: () => true });

        // If it returns 401 (Unauthorized) it means WAF let it through to the app (which asked for auth)
        // If it returns 403 (Forbidden) it could be WAF or App. 
        // Usually WAF blocks return html or specific headers. 
        // For this test, let's assume we want ANY block.
        if (res.status === 403 || res.status === 404) { // 404 might mean hidden
            console.log(`${GREEN}✅  BLOCKED/HIDDEN (${res.status})${RESET}`);
        } else if (res.status === 200) {
            console.log(`${RED}❌  FAILED (Exposed - 200)${RESET}`);
        } else {
            console.log(`${YELLOW}⚠️  UNCERTAIN (${res.status})${RESET}`);
        }
        console.log(`       Attack: Accessing restricted '/${path}'`);

    } catch (error: any) {
        console.log(`${RED}ERROR: ${error.message}${RESET}`);
    }
}

async function testLoginAttack() {
    const label = "LOGIN ATTACK";
    const path = "api/v1/auth/signin";
    process.stdout.write(`${BOLD}[TEST] ${label.padEnd(25)} :: ${RESET}`);

    // Simulating brute force or invalid payload
    // Sending rapid requests or bad patterns
    try {
        const res = await axios.post(`${TARGET}/${path}`, {
            email: "' OR 1=1 --",
            password: "password123"
        }, { validateStatus: () => true });

        if (res.status === 403 || res.status === 406) {
            console.log(`${GREEN}✅  BLOCKED (${res.status})${RESET}`);
        } else if (res.status === 200 || res.status === 400 || res.status === 401) {
            // 400/401 means app handled it (so WAF didn't block it, but app rejected it)
            // If strict WAF, SQLi in payload should be blocked.
            console.log(`${YELLOW}⚠️  UNCERTAIN (${res.status})${RESET}`);
            console.log(`       (App response suggests WAF might have allowed SQLi payload to pass)`);
        } else {
            console.log(`${YELLOW}⚠️  UNCERTAIN (${res.status})${RESET}`);
        }
        console.log(`       Attack: SQLi payload on '/${path}'`);

    } catch (error: any) {
        console.log(`${RED}ERROR: ${error.message}${RESET}`);
    }
}

async function testRegistrationSpam() {
    const label = "REGISTRATION SPAM";
    const path = "api/v1/auth/register";
    process.stdout.write(`${BOLD}[TEST] ${label.padEnd(25)} :: ${RESET}`);

    try {
        // Simulate bot-like registration (missing CSRF, bad headers, fast repetition possible)
        const res = await axios.post(`${TARGET}/${path}`, {
            username: "spam_bot",
            email: "spam@bot.com",
            password: "password123"
        }, {
            headers: { 'User-Agent': 'python-requests/2.28' }, // Bot-like UA
            validateStatus: () => true
        });

        if (res.status === 403 || res.status === 406) {
            console.log(`${GREEN}✅  BLOCKED (${res.status})${RESET}`);
        } else {
            // This is a softer check, usually rate limiting handles spam
            console.log(`${YELLOW}⚠️  UNCERTAIN (${res.status})${RESET}`);
        }
        console.log(`       Attack: Bot access to '/${path}'`);

    } catch (error: any) {
        console.log(`${RED}ERROR: ${error.message}${RESET}`);
    }
}

async function run() {
    printBanner();
    console.log(`\n${CYAN}[INFO] Initializing Attack Protocols...${RESET}\n`);

    await testSQLInjection();
    await sleep(500);
    await testBadBot();
    await sleep(500);
    await testAdminAccess();
    await sleep(500);
    await testLoginAttack();
    await sleep(500);
    await testRegistrationSpam();

    console.log(`${CYAN}
 -------------------------------------------------------------------------------------------------
 |                   >>>  SYSTEM REPORT: ATTACKS COMPLETED  <<<              |
 -------------------------------------------------------------------------------------------------
${RESET}`);
}

run().catch(console.error);
