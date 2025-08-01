const express = require("express");
const rateLimit = require("express-rate-limit");
const bodyParser = require("body-parser");
const redis = require("redis");
const { verifyEmailWithCache } = require("./verifyEmail");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1); // ✅ Allow Express to trust Render or Railway proxy

// Middleware
app.use(bodyParser.json());

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // Limit each IP to 100 requests
});
app.use(limiter);

// ✅ Redis Client with Upstash TLS
const redisClient = redis.createClient({
    url: process.env.REDIS_URL,
    socket: {
        tls: true // Required for Upstash over TLS
    }
});

redisClient.on("error", (err) => console.error("❌ Redis Error:", err));

// Connect to Redis
(async () => {
    try {
        await redisClient.connect();
        console.log("✅ Connected to Upstash Redis");
    } catch (err) {
        console.error("❌ Redis connection error:", err);
    }
})();

// ✅ Health check route
app.get("/", (req, res) => {
    res.send("Email Verification API is running!");
});

// Bulk Email Verification API
app.post("/verify-emails", async (req, res) => {
    const { emails } = req.body;
    if (!Array.isArray(emails) || emails.length === 0) {
        return res.status(400).json({ error: "Emails should be a non-empty array" });
    }

    const results = await Promise.all(
        emails.map(async (email) => await verifyEmailWithCache(email, redisClient))
    );

    res.json({ results });
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
