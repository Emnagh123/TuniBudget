export default function ThemeToggle({ theme, onToggle }) {
  const nextTheme = theme === "light" ? "dark" : "light";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        {theme === "light" ? (
          <path d="M17 12.2A7.6 7.6 0 0 1 7.8 3a7.6 7.6 0 1 0 9.2 9.2Z" />
        ) : (
          <>
            <circle cx="10" cy="10" r="3.3" />
            <path d="M10 1.5v2M10 16.5v2M18.5 10h-2M3.5 10h-2m14.5-6-1.4 1.4M5.4 14.6 4 16m12 0-1.4-1.4M5.4 5.4 4 4" />
          </>
        )}
      </svg>
      <span>{nextTheme === "dark" ? "Dark mode" : "Light mode"}</span>
    </button>
  );
}
