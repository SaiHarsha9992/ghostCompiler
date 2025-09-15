// worker.js
const queue = require("./queue");
const fs = require("fs");
const path = require("path");
const { v4: uuid } = require("uuid");
const { spawn } = require("child_process");

const TEMP_DIR = path.join(__dirname, "temp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

function runCommand(command, args, cwd, timeout = 5000) {
  return new Promise((resolve) => {
    console.log(`Running: ${command} ${args.join(" ")}`);
    const proc = spawn(command, args, { cwd });

    let output = "";
    let error = "";

    const timer = setTimeout(() => {
      proc.kill();
      resolve({ output: "Error: Execution timed out" });
    }, timeout);

    proc.stdout.on("data", (data) => (output += data.toString()));
    proc.stderr.on("data", (data) => (error += data.toString()));

    proc.on("close", () => {
      clearTimeout(timer);
      if (error) resolve({ output: error });
      else resolve({ output });
    });
  });
}

queue.process(async (job) => {
  const { language, code } = job.data;
  const id = uuid();
  const folder = path.join(TEMP_DIR, id);
  fs.mkdirSync(folder, { recursive: true });
  let filePath;

  try {
    switch (language.toLowerCase()) {
      case "python":
        filePath = path.join(folder, "main.py");
        fs.writeFileSync(filePath, code);
        return await runCommand("python", [filePath], folder);

      case "javascript":
        filePath = path.join(folder, "main.js");
        fs.writeFileSync(filePath, code);
        return await runCommand("node", [filePath], folder);

      case "c":
        filePath = path.join(folder, "main.c");
        fs.writeFileSync(filePath, code);
        const cOut = path.join(folder, process.platform === "win32" ? "a.exe" : "a.out");
        const compileC = await runCommand("gcc", [filePath, "-o", cOut], folder);
        if (compileC.output) return compileC;
        return await runCommand(cOut, [], folder);

      case "cpp":
        filePath = path.join(folder, "main.cpp");
        fs.writeFileSync(filePath, code);
        const cppOut = path.join(folder, process.platform === "win32" ? "a.exe" : "a.out");
        const compileCpp = await runCommand("g++", [filePath, "-o", cppOut], folder);
        if (compileCpp.output) return compileCpp;
        return await runCommand(cppOut, [], folder);

      case "java":
        filePath = path.join(folder, "Main.java");
        fs.writeFileSync(filePath, code);
        const compileJava = await runCommand("javac", [filePath], folder);
        if (compileJava.output) return compileJava;
        return await runCommand("java", ["-cp", folder, "Main"], folder);

      default:
        return { output: "Unsupported language" };
    }
  } catch (err) {
    return { output: err.message };
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
    console.log("Cleaned up:", folder);
  }
});
