require("dotenv").config();
const { createClient } = require("redis");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const TEMP_DIR = "./temp";
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

// Redis client
const redis = createClient({
    url: process.env.REDIS_URL,
    socket: { tls: true, rejectUnauthorized: false, connectTimeout: 10000 },
});

redis.on("error", (err) => console.error("Redis Client Error:", err));

(async () => {
    await redis.connect();
    console.log("✅ Worker connected to Redis");

    while (true) {
        const jobData = await redis.blPop("jobQueue", 0);
        const job = JSON.parse(jobData.element);
        console.log("Processing job:", job.id);

        let command, args = [];
        const { code, input } = job;
        let stdout = "", stderr = "";
        let tempFileCreated = false;
        let cleanupPaths = [];

        try {
            switch (job.language) {
                case "python":
                    command = "python";
                    args = ["-c", code]; // Execute code directly
                    break;
                case "javascript":
                    command = "node";
                    args = ["-e", code]; // Execute code directly
                    break;
                case "c":
                case "cpp":
                case "java":
                    tempFileCreated = true;
                    const filePath = path.join(TEMP_DIR, `${job.id}.${job.language}`);
                    fs.writeFileSync(filePath, code);
                    cleanupPaths.push(filePath);

                    if (job.language === "c" || job.language === "cpp") {
                        const outPath = path.join(TEMP_DIR, `${job.id}.out`);
                        cleanupPaths.push(outPath);
                        
                        await new Promise((resolve, reject) => {
                            const compile = spawn(job.language === "c" ? "gcc" : "g++", [filePath, "-o", outPath]);
                            compile.stderr.on('data', (data) => stderr += data.toString());
                            compile.on("close", (code) => code !== 0 ? reject(new Error("Compilation failed")) : resolve());
                        });
                        command = outPath;
                    } else if (job.language === "java") {
                        const mainClassPath = path.join(TEMP_DIR, "Main.class");
                        cleanupPaths.push(mainClassPath);

                        await new Promise((resolve, reject) => {
                            const compile = spawn("javac", [filePath]);
                            compile.stderr.on('data', (data) => stderr += data.toString());
                            compile.on("close", (code) => code !== 0 ? reject(new Error("Compilation failed")) : resolve());
                        });
                        command = "java";
                        args = ["-cp", TEMP_DIR, "Main"];
                    }
                    break;
                default:
                    await redis.set(`result:${job.id}`, JSON.stringify({ status: "error", output: "Unsupported language" }));
                    continue;
            }

            let result;
            try {
                console.log("Spawning command:", command, args);
                const child = spawn(command, args, { timeout: 5000 });

                child.stdin.write(input);
                child.stdin.end();

                child.stdout.on('data', (data) => { stdout += data.toString(); console.log("stdout:", data.toString()); });
                child.stderr.on('data', (data) => { stderr += data.toString(); console.log("stderr:", data.toString()); });

                await new Promise((resolve, reject) => {
                    child.on('close', (code) => {
                        if (code === 0) {
                            resolve();
                        } else {
                            reject(new Error(stderr || "Program execution failed"));
                        }
                    });
                    child.on('error', (err) => reject(err));
                });

                result = { status: "done", output: stdout, error: stderr };

            } catch (err) {
                console.error("Execution failed:", err.message);
                result = { status: "error", output: stdout, error: err.message };
            } finally {
                // Cleanup temp files
                cleanupPaths.forEach(p => {
                    try { fs.rmSync(p, { force: true }); } catch (e) { console.error(`Failed to clean up file: ${p}`, e); }
                });
            }
            
            await redis.set(`result:${job.id}`, JSON.stringify(result));
            console.log("Job finished:", job.id);

        } catch (e) {
            console.error("Worker caught an exception:", e.message);
            await redis.set(`result:${job.id}`, JSON.stringify({ status: "error", output: e.message }));
        }
    }
})();