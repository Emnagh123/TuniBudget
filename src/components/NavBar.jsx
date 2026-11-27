import { StarMark } from "./StarMark.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import { PremiumBadge } from "./PremiumHint.jsx";

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "accounts", label: "Accounts" },
  { id: "transfer", label: "Transfer" },
  { id: "history", label: "History" },
  { id: "budgets", label: "Budgets" },
];

function initials(fullName) {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export default function NavBar({ user, page, theme, onThemeToggle, onNavigate, onLogout }) {
  // The Admin tab is only a shortcut: the server refuses admin calls from anyone else.
  // Free users get a "Go Premium" tab to upgrade; Premium users reach their plan from the badge.
  const tabs = user.role === "admin" ? [...TABS, { id: "admin", label: "Admin" }] : user.plan === "premium" ? TABS : [...TABS, { id: "premium", label: "Go Premium" }];
  return (
    <header className="navbar">
      <div className="navbar__inner">
        <button type="button" className="brand" onClick={() => onNavigate("dashboard")} aria-label="TuniBudget, go to the dashboard">
          <StarMark />
          <span className="brand__name">TuniBudget</span>
        </button>
        <nav className="tabs" aria-label="Main navigation">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={"tab" + (tab.id === "premium" ? " tab--premium" : "")}
              aria-current={page === tab.id ? "page" : undefined}
              onClick={() => onNavigate(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="who">
          <span className="avatar" aria-hidden="true">
            {initials(user.fullName)}
          </span>
          <span className="who__name">{user.fullName}</span>
          {user.plan === "premium" && (
            <button type="button" className="premium-badge-button" onClick={() => onNavigate("premium")} aria-label="My plan" title="My plan">
              <PremiumBadge label={user.role === "admin" ? "Admin" : "Premium"} />
            </button>
          )}
          <ThemeToggle theme={theme} onToggle={onThemeToggle} />
          <button type="button" className="link-button muted" onClick={onLogout} style={{ fontWeight: 500 }}>
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
