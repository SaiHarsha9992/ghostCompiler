require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { v4: uuid } = require("uuid");
const { createClient } = require("redis");

const app = express();
app.use(cors());
app.use(express.json());

console.log("Using Redis URL:", process.env.REDIS_URL);
// Redis client
const redis = createClient({
  url: process.env.REDIS_URL,
  socket: { tls: true, rejectUnauthorized: false, connectTimeout: 10000 },
});

redis.on("error", (err) => console.error("Redis Client Error:", err));

(async () => {
  await redis.connect();
  console.log("✅ Connected to Redis");
})();

// Push job to Redis
app.post("/run", async (req, res) => {
  const { id, language, code } = req.body;
  if (!id || !language || !code) {
    return res.status(400).json({ error: "Missing id, language, or code" });
  }
  await redis.rPush("jobQueue", JSON.stringify({ id, language, code }));
  res.json({ id, status: "queued" });
});

// Get job result
app.get("/status/:id", async (req, res) => {
  const jobId = req.params.id;
  const result = await redis.get(`result:${jobId}`);
  if (!result) return res.json({ status: "pending" });
  res.json(JSON.parse(result));
});

app.listen(8080, () => console.log("API server running on port 8080"));
