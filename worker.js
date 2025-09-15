require("dotenv").config();
const { createClient } = require("redis");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const util = require("util");

const execPromise = util.promisify(exec);
const TEMP_DIR = "./temp";
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

// Redis client
const redis = createClient({
  url: process.env.REDIS_URL, // same as server
  socket: { tls: true, rejectUnauthorized: false, connectTimeout: 10000 },
});

redis.on("error", (err) => console.error("Redis Client Error:", err));

(async () => {
  await redis.connect();
  console.log("✅ Worker connected to Redis");

  // Start processing jobs
  while (true) {
    const jobData = await redis.blPop("jobQueue", 0); // blocking pop
    const job = JSON.parse(jobData.element);
    console.log("Processing job:", job.id);

    let filePath, command;

    try {
      switch (job.language) {
        case "python":
          filePath = path.join(TEMP_DIR, `${job.id}.py`);
          fs.writeFileSync(filePath, job.code);
          command = `python ${filePath}`;
          break;
        case "javascript":
          filePath = path.join(TEMP_DIR, `${job.id}.js`);
          fs.writeFileSync(filePath, job.code);
          command = `node ${filePath}`;
          break;
        case "c":
          filePath = path.join(TEMP_DIR, `${job.id}.c`);
          const outC = path.join(TEMP_DIR, `${job.id}.out`);
          fs.writeFileSync(filePath, job.code);
          command = `gcc ${filePath} -o ${outC} && ${outC}`;
          break;
        case "cpp":
          filePath = path.join(TEMP_DIR, `${job.id}.cpp`);
          const outCpp = path.join(TEMP_DIR, `${job.id}.out`);
          fs.writeFileSync(filePath, job.code);
          command = `g++ ${filePath} -o ${outCpp} && ${outCpp}`;
          break;
        case "java":
          filePath = path.join(TEMP_DIR, `${job.id}.java`);
          fs.writeFileSync(filePath, job.code);
          command = `javac ${filePath} && java -cp ${TEMP_DIR} Main`;
          break;
        default:
          await redis.set(`result:${job.id}`, JSON.stringify({ status: "error", output: "Unsupported language" }));
          continue;
      }

      let result;
      try {
        const { stdout } = await execPromise(command, { timeout: 5000 });
        result = { status: "done", output: stdout };
      } catch (err) {
        result = { status: "error", output: err.stderr || err.message };
      }

      // cleanup
      try { fs.rmSync(filePath, { force: true }); } catch {}
      if (["c", "cpp"].includes(job.language)) {
        try { fs.rmSync(path.join(TEMP_DIR, `${job.id}.out`), { force: true }); } catch {}
      }
      if (job.language === "java") {
        try { fs.rmSync(path.join(TEMP_DIR, "Main.class"), { force: true }); } catch {}
      }

      await redis.set(`result:${job.id}`, JSON.stringify(result));
      console.log("Job finished:", job.id);

    } catch (e) {
      await redis.set(`result:${job.id}`, JSON.stringify({ status: "error", output: e.message }));
    }
  }
})();
