// const dns = require("dns");
// const { Worker } = require("worker_threads");

// async function verifyEmail(email) {
//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     if (!emailRegex.test(email)) {
//         return { email, valid: false, reason: "Invalid email format" };
//     }

//     const domain = email.split("@")[1];
//     return new Promise((resolve) => {
//         dns.resolveMx(domain, async (err, mxRecords) => {
//             if (err || mxRecords.length === 0) {
//                 return resolve({ email, valid: false, reason: "No MX records found" });
//             }

//             const verificationResult = await verifySMTP(email, mxRecords);
//             resolve(verificationResult);
//         });
//     });
// }

// function verifySMTP(email, mxRecords) {
//     return new Promise((resolve) => {
//         const worker = new Worker("./smtpWorker.js");
//         worker.postMessage({ email, mxRecords });

//         worker.on("message", (result) => resolve(result));
//         worker.on("error", () => resolve({ email, valid: false, reason: "Worker error" }));
//         worker.on("exit", () => worker.terminate());
//     });
// }

// async function verifyEmailWithCache(email, redisClient) {
//     return new Promise((resolve) => {
//         redisClient.get(email, async (err, cachedResult) => {
//             if (cachedResult) {
//                 return resolve(JSON.parse(cachedResult));
//             }

//             const result = await verifyEmail(email);
//             redisClient.setex(email, 86400, JSON.stringify(result)); // Cache for 24 hours
//             resolve(result);
//         });
//     });
// }

// module.exports = { verifyEmailWithCache };



const dns = require("dns");
const net = require("net");

// Simple SMTP check (no worker threads)
function verifySMTP(email, mxRecords) {
    return new Promise((resolve) => {
        const mx = mxRecords[0].exchange;
        const socket = net.createConnection(25, mx);

        let response = "";
        let step = 0;
        let finished = false;

        const commands = [
            `HELO example.com\r\n`,
            `MAIL FROM:<verify@example.com>\r\n`,
            `RCPT TO:<${email}>\r\n`,
            `QUIT\r\n`
        ];

        socket.setTimeout(5000);

        socket.on("data", (data) => {
            response += data.toString();
            if (step < commands.length) {
                socket.write(commands[step]);
                step++;
            } else {
                if (!finished) {
                    finished = true;
                    socket.end();
                    if (response.includes("250")) {
                        resolve({ email, valid: true, reason: "SMTP check passed" });
                    } else {
                        resolve({ email, valid: false, reason: "SMTP check failed" });
                    }
                }
            }
        });

        socket.on("timeout", () => {
            if (!finished) {
                finished = true;
                socket.destroy();
                resolve({ email, valid: false, reason: "SMTP timeout" });
            }
        });

        socket.on("error", () => {
            if (!finished) {
                finished = true;
                resolve({ email, valid: false, reason: "SMTP error" });
            }
        });

        socket.on("end", () => {
            if (!finished) {
                finished = true;
                resolve({ email, valid: false, reason: "SMTP connection ended" });
            }
        });
    });
}

async function verifyEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { email, valid: false, reason: "Invalid email format" };
    }

    const domain = email.split("@")[1];
    return new Promise((resolve) => {
        dns.resolveMx(domain, async (err, mxRecords) => {
            if (err || !mxRecords || mxRecords.length === 0) {
                return resolve({ email, valid: false, reason: "No MX records found" });
            }

            const verificationResult = await verifySMTP(email, mxRecords);
            resolve(verificationResult);
        });
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
