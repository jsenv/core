// Formats a number of milliseconds as a short duration string.
//
// Rules:
//   - No rounding: full precision is preserved
//   - Always short unit notation: ms, s, m, h
//   - Sub-ms values        → "0.1ms"
//   - < 1s, ≤2 decimal places as seconds → "0.1s", "0.01s"
//   - < 1s, 3+ decimal places as seconds → "1ms", "10ms", "100ms"
//   - ≥ 1s                 → compound units: "1m1s", "1h30m", "1h30m30.5s"
//
// Examples:
//   formatSeconds(0.1)    → "0.1s"
//   formatSeconds(0.01)   → "0.01s"
//   formatSeconds(0.001)  → "1ms"
//   formatSeconds(61)     → "1m1s"
//   formatMinutes(90)     → "1h30m"
//   formatHours(1.5)      → "1h30m"

const formatDurationMs = (rawMs) => {
  // Clean up floating point noise (round to nearest microsecond)
  const totalMs = Math.round(rawMs * 1e3) / 1e3;
  if (totalMs === 0) {
    return "0s";
  }
  if (totalMs < 1) {
    return `${trimDecimal(totalMs)}ms`;
  }
  if (totalMs < 1000) {
    const asSec = totalMs / 1000;
    const asSecStr = trimDecimal(asSec);
    const decimalPart = asSecStr.split(".")[1] || "";
    if (decimalPart.length <= 2) {
      return `${asSecStr}s`;
    }
    return `${trimDecimal(totalMs)}ms`;
  }
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = (totalMs % 60_000) / 1_000;
  const parts = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${trimDecimal(seconds)}s`);
  }
  return parts.join("");
};

const trimDecimal = (n) => {
  const s = String(n);
  if (!s.includes(".")) {
    return s;
  }
  return s.replace(/\.?0+$/, "");
};

export const formatSeconds = (s) => formatDurationMs(s * 1_000);
export const formatMinutes = (m) => formatDurationMs(m * 60_000);
export const formatHours = (h) => formatDurationMs(h * 3_600_000);
