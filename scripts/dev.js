// `npm run project`: starts the API server and the Vite dev server together, and stops both on Ctrl+C.
// Vite forwards every /api call to the API (see vite.config.js), so the browser only ever talks to
// one address and the session cookie stays SameSite=Strict.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));

const children = [
  // --watch: the API restarts by itself when a file in server/ changes (no stale code after an edit).
  spawn(process.execPath, ["--watch-path=server", "--watch-preserve-output", "server/index.js"], { cwd: root, stdio: "inherit" }),
  spawn(process.execPath, [vite, "--open"], { cwd: root, stdio: "inherit" }),
];

function stopAll(code) {
  for (const child of children) if (child.exitCode === null) child.kill();
  process.exit(code);
}

children[0].on("exit", (code) => {
  // The API stops by itself only on a fatal error (bad .env, no database): stop Vite too.
  if (code) stopAll(code);
});
children[1].on("exit", (code) => stopAll(code || 0));
process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
