// Entry point: check the environment, connect to MongoDB, then listen (HTTPS when a certificate is configured).
import { readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { loadConfig } from "./config.js";
import { client, connect } from "./db.js";
import { createApp } from "./app.js";
import { configureAudit } from "./security/audit.js";
import { configureSessions } from "./security/sessions.js";
import { configureMailer } from "./mailer.js";

const config = loadConfig();
configureAudit(config);
configureSessions(config);
configureMailer(config);

try {
  await connect(config);
} catch (err) {
  console.error("[db] Cannot use MongoDB: " + err.message);
  process.exit(1);
}

const app = createApp(config);
const server = config.tlsCertFile
  ? https.createServer({ cert: readFileSync(config.tlsCertFile), key: readFileSync(config.tlsKeyFile), minVersion: "TLSv1.2" }, app)
  : http.createServer(app);

// Slow-client protection: requests must arrive within 30 s.
server.requestTimeout = 30_000;
server.headersTimeout = 20_000;

server.listen(config.port, () => {
  const scheme = config.tlsCertFile ? "https" : "http";
  console.log(`[server] TuniBudget API (${config.nodeEnv}) listening on ${scheme}://localhost:${config.port}`);
});

async function shutdown(signal) {
  console.log(`[server] ${signal} received, closing.`);
  server.close();
  if (client) await client.close();
  process.exit(0);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
