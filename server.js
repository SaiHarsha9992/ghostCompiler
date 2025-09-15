const express = require("express");
const bodyParser = require("body-parser");
const Docker = require("dockerode");
const cors = require("cors");
const app = express();

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(bodyParser.json());

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

app.post("/run", async (req, res) => {
  const { language, code, input } = req.body;

  let image, command;
  if (language === "cpp") {
    image = "gcc:latest";
    command = ["bash", "-c", "echo \"$CODE\" > main.cpp && g++ main.cpp -o main && ./main"];
  } else if (language === "python") {
    image = "python:3.11";
    command = ["bash", "-c", "echo \"$CODE\" > main.py && python main.py"];
  } else if (language === "java") {
    image = "openjdk:17";
    command = ["bash", "-c", "echo \"$CODE\" > Main.java && javac Main.java && java Main"];
  } else {
    return res.status(400).send("Unsupported language");
  }

  try {
    const container = await docker.createContainer({
      Image: image,
      Cmd: command,
      Env: [`CODE=${code}`, `INPUT=${input}`],
      AttachStdout: true,
      AttachStderr: true,
      Tty: false
    });

    await container.start();

    const stream = await container.attach({ stream: true, stdout: true, stderr: true });
    let output = "";
    stream.on("data", (chunk) => (output += chunk.toString()));

    await container.wait();
    await container.remove();

    res.send({ output });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error running code");
  }
});

app.listen(8080, () => console.log("Compiler API running on port 8080"));
