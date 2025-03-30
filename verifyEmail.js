const dns = require("dns");
const { Worker } = require("worker_threads");

async function verifyEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { email, valid: false, reason: "Invalid email format" };
    }

    const domain = email.split("@")[1];
    return new Promise((resolve) => {
        dns.resolveMx(domain, async (err, mxRecords) => {
            if (err || mxRecords.length === 0) {
                return resolve({ email, valid: false, reason: "No MX records found" });
            }

            const verificationResult = await verifySMTP(email, mxRecords);
            resolve(verificationResult);
        });
    });
}

function verifySMTP(email, mxRecords) {
    return new Promise((resolve) => {
        const worker = new Worker("./smtpWorker.js");
        worker.postMessage({ email, mxRecords });

        worker.on("message", (result) => resolve(result));
        worker.on("error", () => resolve({ email, valid: false, reason: "Worker error" }));
        worker.on("exit", () => worker.terminate());
    });
}

async function verifyEmailWithCache(email, redisClient) {
    return new Promise((resolve) => {
        redisClient.get(email, async (err, cachedResult) => {
            if (cachedResult) {
                return resolve(JSON.parse(cachedResult));
            }

            const result = await verifyEmail(email);
            redisClient.setex(email, 86400, JSON.stringify(result)); // Cache for 24 hours
            resolve(result);
        });
    });
}

module.exports = { verifyEmailWithCache };
