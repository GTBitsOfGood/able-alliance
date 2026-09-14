export function registerHttpRoutes(app) {
  app.get("/", (req, res) => {
    res.json({ message: "Express server running", ok: true });
  });
  app.get("/health", (req, res) => {
    res.status(200).send("OK");
  });
}
