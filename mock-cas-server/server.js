const express = require("express");
const { v4: uuidv4 } = require("uuid");
const users = require("./users.json");

const app = express();
app.use(express.urlencoded({ extended: true }));

// In-memory ticket store: ticket -> { username, attributes, service, createdAt }
const tickets = new Map();

// Ticket expiration: 30 seconds
const TICKET_TTL_MS = 30_000;

// Clean up expired tickets periodically
setInterval(() => {
  const now = Date.now();
  for (const [ticket, data] of tickets.entries()) {
    if (now - data.createdAt > TICKET_TTL_MS) {
      tickets.delete(ticket);
    }
  }
}, 10_000);

// ─── GET /cas/login ─────────────────────────────────────────────────────────
// Displays a login form. The `service` query param is the callback URL.
app.get("/cas/login", (req, res) => {
  const service = req.query.service || "";

  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mock CAS - Georgia Tech Login</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #003057;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .login-container {
      background: white;
      border-radius: 8px;
      padding: 2rem;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }
    .logo {
      text-align: center;
      margin-bottom: 1.5rem;
    }
    .logo h1 {
      color: #003057;
      font-size: 1.5rem;
    }
    .logo p {
      color: #B3A369;
      font-size: 0.875rem;
      margin-top: 0.25rem;
    }
    .mock-badge {
      background: #ff6b35;
      color: white;
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      font-size: 0.75rem;
      display: inline-block;
      margin-bottom: 1rem;
    }
    label {
      display: block;
      margin-bottom: 0.25rem;
      font-weight: 600;
      color: #333;
      font-size: 0.875rem;
    }
    input[type="text"], input[type="password"] {
      width: 100%;
      padding: 0.625rem;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 1rem;
      margin-bottom: 1rem;
    }
    input:focus {
      outline: none;
      border-color: #B3A369;
      box-shadow: 0 0 0 2px rgba(179, 163, 105, 0.3);
    }
    button {
      width: 100%;
      padding: 0.75rem;
      background: #003057;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 1rem;
      cursor: pointer;
      font-weight: 600;
    }
    button:hover { background: #004080; }
    .error { color: #d32f2f; font-size: 0.875rem; margin-bottom: 1rem; }
    .users-hint {
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid #eee;
      font-size: 0.75rem;
      color: #666;
    }
    .users-hint code {
      background: #f5f5f5;
      padding: 0.125rem 0.25rem;
      border-radius: 2px;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div class="login-container">
    <div class="logo">
      <h1>Georgia Tech</h1>
      <p>Central Authentication Service</p>
      <span class="mock-badge">MOCK SERVER</span>
    </div>
    <form method="POST" action="/cas/login?service=${encodeURIComponent(service)}">
      <label for="username">GT Username</label>
      <input type="text" id="username" name="username" placeholder="gburdell3" required autofocus />
      <label for="password">Password</label>
      <input type="password" id="password" name="password" placeholder="password" required />
      <button type="submit">LOGIN</button>
    </form>
    <div class="users-hint">
      <strong>Test accounts:</strong><br>
      <code>gburdell3</code> / <code>password</code> (Student)<br>
      <code>adminuser</code> / <code>password</code> (Admin)<br>
      <code>driver1</code> / <code>password</code> (Driver)
    </div>
  </div>
</body>
</html>`);
});

// ─── POST /cas/login ────────────────────────────────────────────────────────
// Validates credentials, generates a service ticket, redirects back to service.
app.post("/cas/login", (req, res) => {
  const { username, password } = req.body;
  const service = req.query.service || "";

  const user = users.find(
    (u) => u.username === username && u.password === password,
  );

  if (!user) {
    res.setHeader("Content-Type", "text/html");
    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Mock CAS - Login Failed</title>
  <style>
    body { font-family: sans-serif; background: #003057; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .container { background: white; padding: 2rem; border-radius: 8px; max-width: 400px; text-align: center; }
    .error { color: #d32f2f; margin-bottom: 1rem; }
    a { color: #003057; }
  </style>
</head>
<body>
  <div class="container">
    <p class="error"><strong>Login failed.</strong> Invalid credentials.</p>
    <a href="/cas/login?service=${encodeURIComponent(service)}">Try again</a>
  </div>
</body>
</html>`);
  }

  // Generate CAS service ticket
  const ticket = `ST-${uuidv4()}`;
  tickets.set(ticket, {
    username: user.username,
    attributes: user.attributes,
    service,
    createdAt: Date.now(),
  });

  // Redirect back to the service with the ticket
  const separator = service.includes("?") ? "&" : "?";
  const redirectUrl = `${service}${separator}ticket=${ticket}`;
  console.log(`[CAS] Ticket issued: ${ticket} for user: ${user.username}`);
  res.redirect(302, redirectUrl);
});

// ─── GET /cas/p3/serviceValidate ────────────────────────────────────────────
// CAS 3.0 ticket validation endpoint. Returns XML.
app.get("/cas/p3/serviceValidate", (req, res) => {
  const { ticket, service } = req.query;

  res.setHeader("Content-Type", "application/xml");

  if (!ticket || !service) {
    return res.send(`<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas">
  <cas:authenticationFailure code="INVALID_REQUEST">
    Missing required parameters: ticket and service
  </cas:authenticationFailure>
</cas:serviceResponse>`);
  }

  const ticketData = tickets.get(ticket);

  if (!ticketData) {
    console.log(
      `[CAS] Ticket validation failed: ${ticket} (not found or expired)`,
    );
    return res.send(`<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas">
  <cas:authenticationFailure code="INVALID_TICKET">
    Ticket ${ticket} not recognized or already consumed
  </cas:authenticationFailure>
</cas:serviceResponse>`);
  }

  // Invalidate ticket (single use per CAS spec)
  tickets.delete(ticket);

  console.log(
    `[CAS] Ticket validated: ${ticket} for user: ${ticketData.username}`,
  );

  res.send(`<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas">
  <cas:authenticationSuccess>
    <cas:user>${ticketData.username}</cas:user>
    <cas:attributes>
      <cas:email>${ticketData.attributes.email}</cas:email>
      <cas:displayName>${ticketData.attributes.displayName}</cas:displayName>
      <cas:gtid>${ticketData.attributes.gtid}</cas:gtid>
    </cas:attributes>
  </cas:authenticationSuccess>
</cas:serviceResponse>`);
});

// ─── GET /cas/logout ────────────────────────────────────────────────────────
app.get("/cas/logout", (req, res) => {
  const service = req.query.service || "";
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Mock CAS - Logged Out</title>
  <style>
    body { font-family: sans-serif; background: #003057; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .container { background: white; padding: 2rem; border-radius: 8px; max-width: 400px; text-align: center; }
    a { color: #003057; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Logged Out</h2>
    <p>You have been logged out of CAS.</p>
    ${service ? `<p><a href="${service}">Return to application</a></p>` : ""}
  </div>
</body>
</html>`);
});

// ─── Health check ───────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "mock-cas-server" });
});

// ─── Start server ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8443;
app.listen(PORT, () => {
  console.log(`Mock CAS 3.0 server running on port ${PORT}`);
  console.log(`Login page: http://localhost:${PORT}/cas/login`);
  console.log(`Validate:   http://localhost:${PORT}/cas/p3/serviceValidate`);
  console.log(`Logout:     http://localhost:${PORT}/cas/logout`);
});
