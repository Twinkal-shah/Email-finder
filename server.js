const express = require("express");
const rateLimit = require("express-rate-limit");
const bodyParser = require("body-parser");
const redis = require("redis");
const { verifyEmailWithCache } = require("./verifyEmail");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1); // ✅ Allow Express to trust Railway's proxy


// Middleware
app.use(bodyParser.json());

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // Limit each IP to 100 requests
});
app.use(limiter);

// Redis Client
const redis = require("redis");

const redisClient = redis.createClient({
    url: process.env.REDIS_URL
});

redisClient.on("error", (err) => console.error("Redis Error:", err));
redisClient.connect().catch(console.error);


// ✅ Fix: Add a route for "/"
app.get("/", (req, res) => {
    res.send("Email Verification API is running!");
});

// Bulk Email Verification API
app.post("/verify-emails", async (req, res) => {
    const { emails } = req.body;
    if (!Array.isArray(emails) || emails.length === 0) {
        return res.status(400).json({ error: "Emails should be a non-empty array" });
    }

    const results = await Promise.all(emails.map(async (email) => {
        return await verifyEmailWithCache(email, redisClient);
    }));

    res.json({ results });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
