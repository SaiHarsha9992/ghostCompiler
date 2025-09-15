const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const queue = require("./queue");

// Start worker
require("./worker");

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post("/run", async (req, res) => {
  const { language, code } = req.body;
  if (!language || !code) return res.status(400).send("Missing language/code");

  const result = await queue.add({ language, code });
  res.json(result);
});

app.listen(8080, () => console.log("Compiler API running on port 8080"));
