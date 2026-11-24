// The eight-point star (khatem) used by the logo and the zellige pattern.
const STAR =
  "M50 28 L39.09 32.59 L43.56 43.56 L32.59 39.09 L28 50 L23.41 39.09 L12.44 43.56 L16.91 32.59 L6 28 L16.91 23.41 L12.44 12.44 L23.41 16.91 L28 6 L32.59 16.91 L43.56 12.44 L39.09 23.41 Z";

export function StarMark({ size = 30, color = "#e2c36c", dot = "#0b0d0c" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" aria-hidden="true">
      <path d={STAR} fill={color} />
      <circle cx="28" cy="28" r="6" fill={dot} />
    </svg>
  );
}

/** A tiled background of outlined stars, drawn behind the content of a dark panel. */
export function StarPattern({ id, opacity = 0.08 }) {
  return (
    <svg
      aria-hidden="true"
      style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%" }}
    >
      <defs>
        <pattern id={id} width="56" height="56" patternUnits="userSpaceOnUse">
          <path d={STAR} fill="none" stroke="#ffffff" strokeOpacity={opacity} strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={"url(#" + id + ")"} />
    </svg>
  );
}
