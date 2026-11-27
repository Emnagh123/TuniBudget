import { useEffect, useState } from "react";
import { checkout, login, register, requestPasswordReset, resetPassword } from "../services/index.js";
import { Checkout, EMPTY_CHECKOUT, cardFilled, cardPayload, priceFor } from "../components/CardForm.jsx";
import { formatTnd } from "../utils/money.js";
import { StarMark, StarPattern } from "../components/StarMark.jsx";
import Icon from "../components/Icon.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";

const TITLES = {
  login: "Welcome back",
  register: "Open your first account",
  forgot: "Forgot your password?",
  reset: "Choose a new password",
};

const SUBMIT_LABELS = { login: "Log in", register: "Create my account", forgot: "Send the reset link", reset: "Save my new password" };

// The reset link looks like https://app/?reset=<token>. Read once when the page opens.
function tokenFromUrl() {
  return new URLSearchParams(window.location.search).get("reset") || "";
}

export default function AuthPage({ theme, onThemeToggle, onAuthenticated }) {
  const [resetToken] = useState(tokenFromUrl);
  const [mode, setMode] = useState(resetToken ? "reset" : "login");
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  // Sign-up only: the plan the new user wants. Premium opens the checkout right after the account
  // is created (the account always starts free; only a payment makes it Premium).
  const [plan, setPlan] = useState("free");
  const [pay, setPay] = useState(EMPTY_CHECKOUT); // { interval, card, promo }
  const [prices, setPrices] = useState(null);
  const wantsPremium = mode === "register" && plan === "premium";

  // Remove the token from the address bar, so it is not kept in the history or shared by mistake.
  useEffect(() => {
    if (resetToken) window.history.replaceState(null, "", window.location.pathname);
  }, [resetToken]);

  const isLogin = mode === "login";
  const showTabs = mode === "login" || mode === "register";
  const showDemoLogin = import.meta.env.DEV && isLogin;

  function update(field, value) {
    setForm({ ...form, [field]: value });
    setError("");
  }

  function switchMode(next) {
    setMode(next);
    setError("");
    setNotice("");
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (mode === "reset" && form.password !== form.confirm) {
      setError("The two passwords are not the same.");
      return;
    }
    if (wantsPremium && !cardFilled(pay.card)) {
      setError("Fill in your card details to pay for Premium, or choose the Free plan.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login" || mode === "register") {
        const result = isLogin ? await login(form.email, form.password) : await register(form);
        if (!wantsPremium) {
          onAuthenticated(result.user);
          return;
        }
        // The account exists now; pay for Premium with the card typed in the same form.
        // Paid or not, the next screen is the payment result (a failed payment leaves a Free account).
        try {
          const paid = await checkout({ interval: pay.interval, card: cardPayload(pay.card), promoCode: pay.promo ? pay.promo.code : "" });
          onAuthenticated(paid.user, { goPremium: true, paymentResult: { ok: true, payment: paid.payment } });
        } catch (payErr) {
          onAuthenticated(result.user, { goPremium: true, paymentResult: { ok: false, message: payErr.message, card: payErr.card || null } });
        }
        return;
      }
      if (mode === "forgot") {
        const result = await requestPasswordReset(form.email);
        setNotice(result.message);
      } else {
        const result = await resetPassword(resetToken, form.password);
        setForm({ ...form, password: "", confirm: "" });
        setMode("login");
        setNotice(result.message);
      }
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  async function tryDemo() {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const result = await login("amine@tunibudget.tn", "demo1234");
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
          <StarMark size={34} color="#fbf38c" dot="#0b0d0c" />
          <span className="brand__name">TuniBudget</span>
        </div>
        <div className="auth__pitch">
          <h1 className="auth__headline">Every millime in its place.</h1>
          <p>Accounts, transfers and budgets in dinar.</p>
        </div>
      </section>

      <section className="auth__panel">
        <ThemeToggle theme={theme} onToggle={onThemeToggle} />
        <form className="auth__form" onSubmit={submit} noValidate>
          {showTabs && (
            <div className="auth__tabs" role="group" aria-label="Choose an action">
              <button type="button" aria-pressed={isLogin} onClick={() => switchMode("login")}>
                Log in
              </button>
              <button type="button" aria-pressed={mode === "register"} onClick={() => switchMode("register")}>
                Create an account
              </button>
            </div>
          )}

          <div>
            <h2 className="auth__title">{TITLES[mode]}</h2>
          </div>

          {notice && (
            <p className="notice notice--ok" role="status">
              <Icon name="check" />
              {notice}
            </p>
          )}

          {mode === "register" && (
            <label className="field">
              Full name
              <input className="input" autoComplete="name" maxLength={80} value={form.fullName} onChange={(e) => update("fullName", e.target.value)} placeholder="First and last name" />
            </label>
          )}
          {mode !== "reset" && (
            <label className="field">
              Email address
              <input className="input" type="email" autoComplete="email" maxLength={254} value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@example.tn" />
            </label>
          )}
          {mode !== "forgot" && (
            <label className="field">
              {mode === "reset" ? "New password" : "Password"}
              <input
                className="input"
                type="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                maxLength={128}
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                placeholder="At least 8 characters"
              />
            </label>
          )}
          {mode === "reset" && (
            <label className="field">
              Repeat the new password
              <input className="input" type="password" autoComplete="new-password" maxLength={128} value={form.confirm} onChange={(e) => update("confirm", e.target.value)} />
            </label>
          )}

          {mode === "register" && (
            <fieldset className="plan-pick">
              <legend>Choose your plan</legend>
              <button type="button" className="plan-pick__option" aria-pressed={plan === "free"} onClick={() => setPlan("free")}>
                <span className="plan-pick__name">Free</span>
                <span className="plan-pick__price">0 TND</span>
                <span className="plan-pick__perk">3 accounts · 3 months of history</span>
              </button>
              <button type="button" className="plan-pick__option plan-pick__option--premium" aria-pressed={plan === "premium"} onClick={() => setPlan("premium")}>
                <span className="plan-pick__name">
                  Premium <span className="premium-badge">Best value</span>
                </span>
                <span className="plan-pick__price">from 9.900 TND / month</span>
                <span className="plan-pick__perk">Unlimited accounts · full history · CSV</span>
              </button>
            </fieldset>
          )}

          {wantsPremium && (
            <fieldset className="auth__payment">
              <legend className="sr-only">Payment method</legend>
              <Checkout
                value={pay}
                onChange={(next) => {
                  setPay(next);
                  setError("");
                }}
                onPrices={setPrices}
                loggedIn={false}
                idPrefix="signup-card"
              />
            </fieldset>
          )}

          {error && (
            <p className="form-error" role="alert">
              <Icon name="warning" />
              {error}
            </p>
          )}

          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? "Please wait…" : wantsPremium ? "Start Premium" + (prices ? " · " + formatTnd(priceFor(prices, pay).amount) : "") : SUBMIT_LABELS[mode]}
          </button>

          {showDemoLogin && (
            <>
              <button type="button" className="btn btn--block" onClick={tryDemo} disabled={busy}>
                Try the demo account
              </button>
              <p className="auth__demo-note">Explore TuniBudget with a ready-made account full of sample data.</p>
            </>
          )}
          {isLogin && (
            <>
              <button type="button" className="link-button auth__switch" onClick={() => switchMode("forgot")}>
                Forgot your password?
              </button>
            </>
          )}
          {(mode === "forgot" || mode === "reset") && (
            <button type="button" className="link-button auth__switch" onClick={() => switchMode("login")}>
              Back to log in
            </button>
          )}

        </form>
      </section>
    </div>
  );
}
