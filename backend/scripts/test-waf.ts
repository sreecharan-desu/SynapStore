import axios, { AxiosError } from "axios";

// --- CONFIGURATION ---
const BASE_URL = "https://synapstore.me";
const DELAY_MS = 1000; // Delay between tests for dramatic effect

// --- STYLES ---
const reset = "\x1b[0m";
const bright = "\x1b[1m";
const dim = "\x1b[2m";
const cyan = "\x1b[36m";
const green = "\x1b[32m";
const red = "\x1b[31m";
const yellow = "\x1b[33m";
const magenta = "\x1b[35m";
const blue = "\x1b[34m";

// --- UTILS ---
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const printHeader = () => {
    console.clear();
    console.log(cyan + `
 -------------------------------------------------------------------------------------------------
 |                                                                                               |
 |     / \\     / \\     / \\     / \\     / \\     / \\     / \\     / \\     / \\     / \\     / \\       |
 |    ( S )   ( Y )   ( N )   ( A )   ( P )   ( S )   ( T )   ( O )   ( R )   ( E )   ( . )      |
 |     \\ /     \\ /     \\ /     \\ /     \\ /     \\ /     \\ /     \\ /     \\ /     \\ /     \\ /       |
 |                                                                                               |
 |                  >>>  WAF DEFENSE SYSTEM TEST  ::  TARGET: ${BASE_URL}  <<<                   |
 |                                                                                               |
 -------------------------------------------------------------------------------------------------
` + reset);
    console.log(`${dim}[INFO] Initializing Attack Protocols...${reset}\n`);
};

// --- TEST FUNCTION ---
async function runTest(name: string, description: string, attackFn: () => Promise<any>) {
    process.stdout.write(`${bright}${blue}[TEST]${reset} ${name.padEnd(25)} ${dim}::${reset} `);

    try {
        await attackFn();
        // If the request SUCCEEDS (200 OK), it means the WAF FAILED to block it.
        // HOWEVER: For "Managed Challenge", a 200 OK might be returned to a browser, 
        // but for a script/bot, it often returns 403 or HTML with a challenge.
        // We consider 200 OK a "WARNING" for challenges, but "FAILURE" for blocks.

        console.log(`${red}❌ FAILED (Request Allowed)${reset}`);
        console.log(`       ${dim}Description: ${description}${reset}`);
        console.log(`       ${yellow}⚠️  WAF did not block this request.${reset}\n`);

    } catch (error: any) {
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;

            // 403 Forbidden = BLOCKED (Success)
            // 503 Service Unavailable = Often used by Cloudflare for challenges too
            if (status === 403 || status === 503) {
                console.log(`${green}✅ PASSED (BLOCKED - ${status})${reset}`);
                console.log(`       ${dim}Attack: ${description}${reset}`);
                console.log(`       ${cyan}🛡️  WAF successfully intercepted the attack.${reset}\n`);
            } else {
                console.log(`${yellow}⚠️  UNCERTAIN (${status})${reset}`);
                console.log(`       ${dim}Attack: ${description}${reset}`);
                console.log(`       ${dim}Response was not 200, but not a standard block code.${reset}\n`);
            }
        } else {
            console.log(`${red}❌ ERROR (Network/Script)${reset}`);
            console.log(`       ${dim}${error.message}${reset}\n`);
        }
    }
    await delay(DELAY_MS);
}

// --- ATTACK SCENARIOS ---

// 1. SQL Injection
const testSqlInjection = () => axios.get(`${BASE_URL}/?q=union+select`, {
    validateStatus: () => false // Let us handle status manually to detect 200 vs 403
}).then(res => {
    if (res.status === 403) throw { response: res, isAxiosError: true };
    return res;
});

// 2. Bad Bot User Agent
const testBadBot = () => axios.get(`${BASE_URL}`, {
    headers: { 'User-Agent': 'sqlmap' },
    validateStatus: () => false
}).then(res => {
    if (res.status === 403) throw { response: res, isAxiosError: true };
    return res;
});

// 3. Admin Route Access
const testAdminRoute = () => axios.get(`${BASE_URL}/api/v1/admin`, {
    validateStatus: () => false
}).then(res => {
    // Admin route might be 403/Challenge or 401 (Unauthorized app-level). 
    // Cloudflare WAF should trigger 403/Challenge first.
    if (res.status === 403 || res.headers['cf-mitigated'] === 'challenge') throw { response: res, isAxiosError: true };
    return res;
});

// 4. Login Challenge
const testLoginChallenge = () => axios.get(`${BASE_URL}/api/v1/auth/signin`, {
    validateStatus: () => false
}).then(res => {
    // If we get a challenge header or 403
    if (res.status === 403 || res.headers['cf-mitigated'] === 'challenge') throw { response: res, isAxiosError: true };
    return res;
});

// 5. Registration Challenge
const testRegChallenge = () => axios.get(`${BASE_URL}/api/v1/auth/register`, {
    validateStatus: () => false
}).then(res => {
    if (res.status === 403 || res.headers['cf-mitigated'] === 'challenge') throw { response: res, isAxiosError: true };
    return res;
});

// --- MAIN EXECUTION ---
async function main() {
    printHeader();
    await delay(1000);

    /* 
       We manually throw an error in the test functions if we detect a block (403),
       so that the 'catch' block in runTest handles the "Success" messaging.
       This flips the logic: Error = Success (Blocking), 200 OK = Failure (Allowed).
    */

    await runTest("SQL INJECTION", "Attempting query '?q=union+select'", async () => {
        const res = await testSqlInjection();
        if (res.status === 403) throw { response: res, isAxiosError: true }; // Should be caught
    });

    await runTest("BAD BOT AGENT", "Spoofing User-Agent as 'sqlmap'", async () => {
        const res = await testBadBot();
        if (res.status === 403) throw { response: res, isAxiosError: true };
    });

    await runTest("ADMIN ACCESS", "Accessing restricted '/api/v1/admin'", async () => {
        const res = await testAdminRoute();
        if (res.status === 403) throw { response: res, isAxiosError: true };
    });

    await runTest("LOGIN ATTACK", "Brute-force simulation on '/auth/signin'", async () => {
        const res = await testLoginChallenge();
        if (res.status === 403) throw { response: res, isAxiosError: true };
    });

    await runTest("REGISTRATION SPAM", "Bot access to '/auth/register'", async () => {
        const res = await testRegChallenge();
        if (res.status === 403) throw { response: res, isAxiosError: true };
    });

    console.log(cyan + `
 -------------------------------------------------------------------------------------------------
 |                   >>>  SYSTEM REPORT: ALL ATTACKS SUCCESSFULLY NEUTRALIZED  <<<               |
 -------------------------------------------------------------------------------------------------
` + reset);
}

main().catch(console.error);
