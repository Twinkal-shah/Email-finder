const { parentPort } = require("worker_threads");
const net = require("net");

parentPort.on("message", (emailData) => {
    const { email, mxRecords } = emailData;
    const mailServer = mxRecords[0].exchange;
    
    const socket = net.createConnection(25, mailServer);
    socket.setTimeout(5000);

    socket.on("connect", () => {
        socket.write(`HELO example.com\r\n`);
        socket.write(`MAIL FROM:<test@example.com>\r\n`);
        socket.write(`RCPT TO:<${email}>\r\n`);
    });

    socket.on("data", (data) => {
        const response = data.toString();
        if (response.includes("250")) {
            parentPort.postMessage({ email, valid: true, reason: "Mailbox exists" });
        } else {
            parentPort.postMessage({ email, valid: false, reason: "Mailbox does not exist" });
        }
        socket.end();
    });

    socket.on("error", () => parentPort.postMessage({ email, valid: false, reason: "SMTP error" }));
    socket.on("timeout", () => parentPort.postMessage({ email, valid: false, reason: "SMTP timeout" }));
});
