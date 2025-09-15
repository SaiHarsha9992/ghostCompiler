const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const { exec } = require("child_process");
const path = require("path");
const { v4: uuid } = require("uuid");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const TEMP_DIR = "./temp";
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

app.post("/run", async (req, res) => {
  const { language, code } = req.body;
  if (!language || !code) return res.status(400).send("Missing language or code");

  const id = uuid(); // unique filename
  let filePath, command;

  try {
    if (language === "python") {
      filePath = path.join(TEMP_DIR, `${id}.py`);
      fs.writeFileSync(filePath, code);
      command = `python3 ${filePath}`;
    } else if (language === "javascript") {
      filePath = path.join(TEMP_DIR, `${id}.js`);
      fs.writeFileSync(filePath, code);
      command = `node ${filePath}`;
    } else if (language === "cpp") {
      filePath = path.join(TEMP_DIR, `${id}.cpp`);
      const outFile = path.join(TEMP_DIR, `${id}.out`);
      fs.writeFileSync(filePath, code);
      command = `g++ ${filePath} -o ${outFile} && ${outFile}`;
    } else if (language === "c") {
      filePath = path.join(TEMP_DIR, `${id}.c`);
      const outFile = path.join(TEMP_DIR, `${id}.out`);
      fs.writeFileSync(filePath, code);
      command = `gcc ${filePath} -o ${outFile} && ${outFile}`;
    } else if (language === "java") {
      filePath = path.join(TEMP_DIR, `${id}.java`);
      fs.writeFileSync(filePath, code);
      command = `javac ${filePath} && java -cp ${TEMP_DIR} Main`; // assume class name Main
    } else {
      return res.status(400).send("Unsupported language");
    }

    exec(command, { timeout: 5000 }, (err, stdout, stderr) => {
      // clean up files
      fs.rmSync(filePath, { force: true });
      if (language === "cpp" || language === "c") fs.rmSync(path.join(TEMP_DIR, `${id}.out`), { force: true });
      if (language === "java") fs.rmSync(path.join(TEMP_DIR, "Main.class"), { force: true });

      if (err) return res.json({ output: stderr || err.message });
      res.json({ output: stdout });
    });
  } catch (err) {
    return res.json({ output: err.message });
  }
});

app.listen(8080, () => console.log("Compiler API running on port 8080"));
