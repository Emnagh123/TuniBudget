/** Progress bar of a budget. The fill is capped at 100 %. */
export default function Meter({ percent, status = "ok", label }) {
  const width = Math.min(Math.max(percent, 0), 100);
  return (
    <div className={"meter" + (status === "ok" ? "" : " meter--" + status)} role="img" aria-label={label || percent + " % used"}>
      <div className="meter__fill" style={{ width: width + "%" }} />
    </div>
  );
}
