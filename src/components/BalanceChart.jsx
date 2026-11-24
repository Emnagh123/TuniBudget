import { useState } from "react";
import { formatDay, formatDayYear, startOfDay } from "../utils/dates.js";
import { formatTnd } from "../utils/money.js";

const WIDTH = 640;
const HEIGHT = 110;
const TOP = 10;
const BOTTOM = 6;

// Hand-drawn SVG line chart, made to sit on the green hero panel (white line, yellow marker).
export default function BalanceChart({ points }) {
  const [hover, setHover] = useState(null);

  const balances = points.map((p) => p.balance);
  const min = Math.min(...balances);
  const max = Math.max(...balances);
  const span = max - min || 1;
  const last = points.length - 1;
  const x = (i) => (last === 0 ? WIDTH : (i / last) * WIDTH);
  const y = (value) => TOP + (1 - (value - min) / span) * (HEIGHT - TOP - BOTTOM);

  const line = points.map((p, i) => (i === 0 ? "M" : "L") + x(i).toFixed(1) + " " + y(p.balance).toFixed(1)).join(" ");
  const area = line + " L" + WIDTH + " " + HEIGHT + " L0 " + HEIGHT + " Z";

  // Axis labels: the first day, the start of each month, and today.
  const labels = [{ i: 0, text: formatDay(startOfDay(points[0].date)), align: "start" }];
  points.forEach((p, i) => {
    if (i > last * 0.1 && i < last * 0.92 && p.date.endsWith("-01")) {
      labels.push({ i, text: startOfDay(p.date).toLocaleDateString("en-US", { month: "short" }) });
    }
  });
  labels.push({ i: last, text: "Today", align: "end" });

  function moveTo(clientX, rect) {
    const fraction = (clientX - rect.left) / rect.width;
    setHover(Math.min(last, Math.max(0, Math.round(fraction * last))));
  }

  function onKeyDown(event) {
    if (event.key === "ArrowLeft") setHover(Math.max(0, (hover === null ? last : hover) - 1));
    if (event.key === "ArrowRight") setHover(Math.min(last, (hover === null ? last : hover) + 1));
    if (event.key === "Escape") setHover(null);
  }

  const active = hover === null ? last : hover;
  const activePoint = points[active];
  const summary =
    "Balance over the last " + points.length + " days, from " + formatTnd(points[0].balance) + " to " + formatTnd(points[last].balance) + ". Use the left and right arrow keys to read each day.";

  return (
    <div className="chart">
      {hover !== null && (
        <div className="chart__tooltip" style={{ left: Math.min(88, Math.max(12, (x(hover) / WIDTH) * 100)) + "%" }}>
          <strong className="num">{formatTnd(activePoint.balance)}</strong>
          <span className="muted">{formatDayYear(startOfDay(activePoint.date))}</span>
        </div>
      )}
      <svg
        className="chart__svg"
        viewBox={"0 0 " + WIDTH + " " + HEIGHT}
        role="img"
        aria-label={summary}
        tabIndex={0}
        onPointerMove={(e) => moveTo(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKeyDown}
        onFocus={() => setHover(last)}
        onBlur={() => setHover(null)}
      >
        <path d={area} fill="#ffffff" fillOpacity="0.12" />
        <path d={line} fill="none" stroke="#ffffff" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1="0" y2={HEIGHT} stroke="#ffffff" strokeOpacity="0.4" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
        <circle cx={x(active)} cy={y(activePoint.balance)} r="6" fill="#fbf38c" stroke="#173b2c" strokeWidth="2.5" />
      </svg>
      <div className="chart__axis" aria-hidden="true">
        {labels.map((label) => (
          <span
            key={label.i}
            style={
              label.align === "end"
                ? { right: 0, transform: "none" }
                : label.align === "start"
                  ? { left: 0, transform: "none" }
                  : { left: (x(label.i) / WIDTH) * 100 + "%" }
            }
          >
            {label.text}
          </span>
        ))}
      </div>
    </div>
  );
}
