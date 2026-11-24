import { useEffect, useState } from "react";
import Icon from "./Icon.jsx";

// A date field drawn in the app's own style (the browser's built-in calendar cannot be styled).
// value and onChange use the same "YYYY-MM-DD" text as <input type="date">, or "" for no date.

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const pad = (n) => String(n).padStart(2, "0");
const keyOf = (date) => date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());

function dateOf(key) {
  if (!key) return null;
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export default function DatePicker({ id, value, onChange, labelledBy, invalid = false, placeholder = "Any date" }) {
  const selected = dateOf(value);
  const todayKey = keyOf(new Date());
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const start = selected || new Date();
    return { year: start.getFullYear(), month: start.getMonth() };
  });

  // Close on a click outside the picker, or on Escape.
  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (!event.target.closest || !event.target.closest('[data-datepicker="' + id + '"]')) setOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, id]);

  function toggle() {
    if (!open) {
      const start = selected || new Date();
      setView({ year: start.getFullYear(), month: start.getMonth() });
    }
    setOpen(!open);
  }

  function moveMonth(delta) {
    const d = new Date(view.year, view.month + delta, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  }

  function pick(key) {
    onChange(key);
    setOpen(false);
  }

  // 6 weeks of days, starting on the Monday on or before the 1st of the month.
  const first = new Date(view.year, view.month, 1);
  const offset = (first.getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, i) => new Date(view.year, view.month, 1 - offset + i));
  const monthTitle = first.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const shown = selected ? selected.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

  return (
    <div className="datepicker" data-datepicker={id}>
      <button
        type="button"
        id={id}
        className={"input datepicker__trigger" + (invalid ? " is-invalid" : "")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby={labelledBy + " " + id}
        aria-invalid={invalid ? "true" : "false"}
        onClick={toggle}
      >
        <span className={shown ? "" : "datepicker__placeholder"}>{shown || placeholder}</span>
        <span className="datepicker__icon" aria-hidden="true">
          <Icon name="calendar" size={15} />
        </span>
      </button>

      {open && (
        <div className="datepicker__panel" role="dialog" aria-label="Choose a date">
          <div className="datepicker__head">
            <button type="button" className="datepicker__nav" onClick={() => moveMonth(-1)} aria-label="Previous month">
              <Icon name="chevronLeft" size={14} />
            </button>
            <span className="datepicker__title" aria-live="polite">
              {monthTitle}
            </span>
            <button type="button" className="datepicker__nav" onClick={() => moveMonth(1)} aria-label="Next month">
              <Icon name="chevronRight" size={14} />
            </button>
          </div>

          <div className="datepicker__grid" key={view.year + "-" + view.month}>
            {WEEKDAYS.map((w) => (
              <span key={w} className="datepicker__weekday" aria-hidden="true">
                {w}
              </span>
            ))}
            {days.map((day) => {
              const key = keyOf(day);
              const classes = ["datepicker__day"];
              if (day.getMonth() !== view.month) classes.push("is-outside");
              if (key === todayKey) classes.push("is-today");
              if (key === value) classes.push("is-selected");
              return (
                <button
                  key={key}
                  type="button"
                  className={classes.join(" ")}
                  aria-pressed={key === value}
                  aria-label={day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                  onClick={() => pick(key)}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="datepicker__foot">
            <button type="button" className="link-button" onClick={() => pick("")}>
              Clear
            </button>
            <button type="button" className="btn btn--small btn--primary" onClick={() => pick(todayKey)}>
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
