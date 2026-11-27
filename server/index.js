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

// Port already taken: almost always an older TuniBudget server still running in the background,
// which would keep answering with old code. Say so clearly instead of a stack trace.
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `\n[server] Port ${config.port} is already used, probably by an OLD TuniBudget server still running.\n` +
        `[server] Close it, then run npm run project again. On Windows (PowerShell):\n` +
        `         Stop-Process -Id (Get-NetTCPConnection -LocalPort ${config.port}).OwningProcess -Force\n`
    );
    process.exit(1);
  }
  throw err;
});

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
