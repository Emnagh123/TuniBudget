// Unit tests of the security building blocks that do not need a database: `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, needsRehash, verifyPassword } from "../security/password.js";
import { fingerprint, newId, randomToken, sha256 } from "../security/tokens.js";
import * as v from "../validate.js";
import { buildConfig } from "../config.js";

const goodEnv = {
  NODE_ENV: "development",
  MONGODB_URI: "mongodb://localhost:27017/?replicaSet=rs0",
  SESSION_SECRET: "x9Fq2LmZp8Rt5Wv1Yb7Nc3Kd6Hj0Gs4Ae2Uo",
  APP_URL: "http://localhost:5173",
};

test("passwords are salted, verified, and wrong passwords are refused", async () => {
  const a = await hashPassword("demo1234");
  const b = await hashPassword("demo1234");
  assert.notEqual(a, b, "two hashes of the same password differ (random salt)");
  assert.ok(a.startsWith("scrypt$32768$8$1$"));
  assert.equal(await verifyPassword("demo1234", a), true);
  assert.equal(await verifyPassword("demo1235", a), false);
  assert.equal(await verifyPassword("demo1234", "mock$2a5b1094"), false, "old fake hashes never match");
  assert.equal(needsRehash(a), false);
  assert.equal(needsRehash("scrypt$16384$8$1$abc$def"), true);
});

test("tokens are random and only their fingerprint is stored", () => {
  const t = randomToken();
  assert.match(t, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(randomToken(), t);
  assert.equal(fingerprint("secret-a", t), fingerprint("secret-a", t));
  assert.notEqual(fingerprint("secret-a", t), fingerprint("secret-b", t));
  assert.equal(sha256("x").length, 64);
  assert.match(newId("acc"), /^acc_[0-9a-f]{24}$/);
});

test("text fields refuse HTML, control characters and bad lengths", () => {
  const rule = { min: 2, max: 40, message: "bad" };
  assert.equal(v.text("  Savings   account ", rule), "Savings account");
  assert.throws(() => v.text("<script>alert(1)</script>", rule), /not allowed/);
  assert.throws(() => v.text("a\u0000b", rule), /special characters/);
  assert.throws(() => v.text("x", rule), /bad/);
  assert.throws(() => v.text({ $gt: "" }, rule), /bad/, "objects are refused (NoSQL injection)");
});

test("emails, ids and amounts are strictly typed", () => {
  assert.equal(v.email(" Amine@TuniBudget.tn "), "amine@tunibudget.tn");
  assert.throws(() => v.email({ $ne: null }));
  assert.throws(() => v.email("not-an-email"));
  assert.equal(v.id("acc_amine_checking", { prefix: "acc" }), "acc_amine_checking");
  assert.throws(() => v.id({ $ne: "" }));
  assert.throws(() => v.id("usr_amine", { prefix: "acc" }));
  assert.equal(v.millimes(1500), 1500);
  assert.equal(v.millimes("1500"), 1500);
  for (const bad of [0, -5, 1.5, "1e3", "12.5", NaN, Infinity, v.MAX_MILLIMES + 1, { $gt: 0 }, null]) {
    assert.throws(() => v.millimes(bad), undefined, "amount " + String(bad));
  }
});

test("password policy", () => {
  assert.equal(v.newPassword("demo1234"), "demo1234");
  assert.throws(() => v.newPassword("short1"), /8 characters/);
  assert.throws(() => v.newPassword("onlyletters"), /letter and one digit/);
  assert.throws(() => v.newPassword("password123"), /too common/);
  assert.throws(() => v.newPassword("a".repeat(129) + "1"), /128/);
});

test("unexpected fields are refused (mass assignment)", () => {
  assert.deepEqual(v.onlyFields({ name: "x" }, ["name"]), { name: "x" });
  assert.throws(() => v.onlyFields({ name: "x", role: "admin" }, ["name"]), /Unexpected field: role/);
  assert.throws(() => v.onlyFields([1], ["name"]));
});

test("dates, months and reset tokens", () => {
  assert.equal(v.month("2026-11"), "2026-11");
  assert.throws(() => v.month("2026-13"));
  assert.equal(v.optionalDay("2026-02-28"), "2026-02-28");
  assert.throws(() => v.optionalDay("2026-02-30"));
  assert.throws(() => v.token("short"), /invalid or has expired/);
  assert.equal(v.token(randomToken()).length, 43);
});

test("environment check accepts a good .env", () => {
  const { errors, config } = buildConfig(goodEnv);
  assert.deepEqual(errors, []);
  assert.equal(config.port, 4000);
  assert.equal(config.appOrigin, "http://localhost:5173");
});

test("environment check refuses missing or weak secrets", () => {
  assert.ok(buildConfig({ ...goodEnv, MONGODB_URI: "" }).errors.some((e) => e.includes("MONGODB_URI is missing")));
  assert.ok(buildConfig({ ...goodEnv, SESSION_SECRET: "" }).errors.some((e) => e.includes("SESSION_SECRET is missing")));
  assert.ok(buildConfig({ ...goodEnv, SESSION_SECRET: "too-short" }).errors.some((e) => e.includes("too short")));
  assert.ok(buildConfig({ ...goodEnv, SESSION_SECRET: "change-me-change-me-change-me-change-me" }).errors.some((e) => e.includes("placeholder")));
  assert.ok(buildConfig({ ...goodEnv, PORT: "abc" }).errors.some((e) => e.includes("PORT")));
});

test("production requires HTTPS and a protected database", () => {
  const prod = { ...goodEnv, NODE_ENV: "production", APP_URL: "http://example.com", MONGODB_URI: "mongodb://db.example.com:27017" };
  const { errors } = buildConfig(prod);
  assert.ok(errors.some((e) => e.includes("APP_URL must start with https://")));
  assert.ok(errors.some((e) => e.includes("user and password")));
  assert.ok(errors.some((e) => e.includes("must use TLS")));
  assert.ok(errors.some((e) => e.includes("HTTPS is required")));

  const ok = buildConfig({
    ...goodEnv,
    NODE_ENV: "production",
    APP_URL: "https://tunibudget.example.com",
    MONGODB_URI: "mongodb+srv://app:Str0ngPass@cluster0.example.mongodb.net",
    TRUST_PROXY: "1",
  });
  assert.deepEqual(ok.errors, []);
});
