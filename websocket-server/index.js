const express = require("express");

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Express server running", ok: true });
});

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

app.listen(PORT, () => {
  console.log(`Express server listening on port ${PORT}`);
});
