import { useState } from "react";
import { login, register } from "../services/index.js";
import { StarMark, StarPattern } from "../components/StarMark.jsx";
import Icon from "../components/Icon.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";

const DEMO = { email: "amine@tunibudget.tn", password: "demo1234" };

export default function AuthPage({ theme, onThemeToggle, onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isLogin = mode === "login";

  function update(field, value) {
    setForm({ ...form, [field]: value });
    setError("");
  }

  function switchMode(next) {
    setMode(next);
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = isLogin ? await login(form.email, form.password) : await register(form);
      onAuthenticated(result.user);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <section className="auth__hero">
        <StarPattern id="auth-pattern" opacity={0.09} />
        <div className="auth__brand">
          <StarMark size={34} color="#ffffff" dot="#123b8f" />
          <span className="brand__name">TuniBudget</span>
        </div>
        <div className="auth__pitch">
          <h1 className="auth__headline">Your money, down to the millime.</h1>
          <p>Several accounts in dinar, one dashboard.</p>
          <p>Transfers that go through completely, or not at all.</p>
          <p>Budgets that warn you before you hit the limit.</p>
        </div>
      </section>

      <section className="auth__panel">
        <ThemeToggle theme={theme} onToggle={onThemeToggle} />
        <form className="auth__form" onSubmit={submit} noValidate>
          <div className="auth__tabs" role="group" aria-label="Choose an action">
            <button type="button" aria-pressed={isLogin} onClick={() => switchMode("login")}>
              Log in
            </button>
            <button type="button" aria-pressed={!isLogin} onClick={() => switchMode("register")}>
              Create an account
            </button>
          </div>

          <div>
            <h2 className="auth__title">{isLogin ? "Welcome back" : "Open your first account"}</h2>
            <p className="muted" style={{ marginTop: 6, fontSize: 16 }}>
              {isLogin ? "Log in to see your accounts." : "A checking account in dinar is created for you."}
            </p>
          </div>

          {!isLogin && (
            <label className="field">
              Full name
              <input className="input" autoComplete="name" value={form.fullName} onChange={(e) => update("fullName", e.target.value)} placeholder="First and last name" />
            </label>
          )}
          <label className="field">
            Email address
            <input className="input" type="email" autoComplete="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@example.tn" />
          </label>
          <label className="field">
            Password
            <input
              className="input"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              placeholder="At least 8 characters"
            />
          </label>

          {error && (
            <p className="form-error" role="alert">
              <Icon name="warning" />
              {error}
            </p>
          )}

          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? "Please wait…" : isLogin ? "Log in" : "Create my account"}
          </button>

          {isLogin && (
            <div className="auth__demo">
              <p className="small muted">
                Demo account: {DEMO.email} with password {DEMO.password}
              </p>
              <button type="button" className="btn btn--small" onClick={() => setForm({ ...form, ...DEMO })}>
                Fill in the demo account
              </button>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
