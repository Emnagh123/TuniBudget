// Small inline SVG icons (no icon library). Always decorative: the text next to them carries the meaning.
const SHAPES = {
  check: <path d="M3 8.5 L6.5 12 L13 4.5" />,
  cross: <path d="M4 4 L12 12 M12 4 L4 12" />,
  undo: <path d="M5 3 L2.5 6 L5 9 M3 6 H9.5 A3.5 3.5 0 0 1 9.5 13 H6" />,
  warning: (
    <>
      <path d="M8 1.8 L15 14 H1 Z" />
      <path d="M8 6.5 V9.5 M8 11.8 V12" />
    </>
  ),
  clock: (
    <>
      <circle cx="8" cy="8" r="6.2" />
      <path d="M8 4.5 V8.4 L10.4 9.8" />
    </>
  ),
  lock: (
    <>
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7 V5 a2.5 2.5 0 0 1 5 0 V7" />
    </>
  ),
  info: (
    <>
      <circle cx="8" cy="8" r="6.2" />
      <path d="M8 7.2 V11 M8 4.8 V5" />
    </>
  ),
  chevronLeft: <path d="M10 3 L5 8 L10 13" />,
  chevronRight: <path d="M6 3 L11 8 L6 13" />,
};

export default function Icon({ name, size = 16 }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {SHAPES[name]}
    </svg>
  );
}
