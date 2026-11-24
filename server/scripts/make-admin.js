// Gives (or removes) the admin role. There is deliberately no API route for this: only someone with
// access to the server and its .env can create an admin.
//   npm run make-admin -- someone@example.com
//   npm run make-admin -- someone@example.com --remove
import { loadConfig } from "../config.js";
import { client, collections, connect } from "../db.js";
import { configureSessions, endAllSessions } from "../security/sessions.js";
import { email } from "../validate.js";

const args = process.argv.slice(2);
const remove = args.includes("--remove");
const target = args.find((a) => !a.startsWith("--"));
if (!target) {
  console.error("Usage: npm run make-admin -- someone@example.com [--remove]");
  process.exit(1);
}

const config = loadConfig();
configureSessions(config);
await connect(config);
try {
  const mail = email(target);
  const role = remove ? "user" : "admin";
  const result = await collections.users.updateOne({ email: mail }, { $set: { role } });
  if (result.matchedCount === 0) {
    console.error(`[make-admin] No user with the email ${mail}. They must register first.`);
    process.exitCode = 1;
  } else {
    const user = await collections.users.findOne({ email: mail });
    await endAllSessions(user._id); // the new role applies from the next login
    await collections.auditLogs.insertOne({ at: new Date(), event: remove ? "admin_role_removed" : "admin_role_granted", level: "warn", userId: user._id, ip: "cli", details: {} });
    console.log(`[make-admin] ${mail} is now "${role}". They must log in again.`);
  }
} finally {
  await client.close();
}
