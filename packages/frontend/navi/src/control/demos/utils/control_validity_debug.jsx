import { Box, useConstraintValidityState } from "@jsenv/navi";

// Subscribes to the validity state of a control (via a ref) and renders it.
export const ControlValidityDebug = ({ inputRef, committedValue }) => {
  const state = useConstraintValidityState(inputRef);

  const entries = Object.entries(state).filter(([key]) => key !== "valid");
  const failingEntries = entries.filter(([, v]) => v !== null);
  const passingEntries = entries.filter(([, v]) => v === null);

  return (
    <Box
      flex="y"
      spacing="xs"
      style={{
        padding: "10px 12px",
        background: "#f8f9fa",
        border: `1px solid ${state.valid ? "#c3e6cb" : "#f5c6cb"}`,
        borderRadius: "6px",
        fontSize: "0.8rem",
        fontFamily: "monospace",
        minWidth: "220px",
      }}
    >
      {/* valid / invalid badge */}
      <span
        style={{
          fontWeight: "bold",
          color: state.valid ? "#155724" : "#c0392b",
        }}
      >
        valid: {String(state.valid)}
      </span>

      {/* committed value (when provided) */}
      {committedValue !== undefined && (
        <span style={{ color: "#555" }}>
          committed: {JSON.stringify(committedValue)}
        </span>
      )}

      {/* failing constraints — always visible */}
      {failingEntries.map(([name, info]) => (
        <Box key={name} flex spacing="s" style={{ color: "#c0392b" }}>
          <span>✗</span>
          <span>
            {name}
            {info && info.messageString ? `: ${info.messageString}` : ""}
          </span>
        </Box>
      ))}

      {/* passing constraints — collapsed */}
      {passingEntries.length > 0 && (
        <details style={{ marginTop: "2px" }}>
          <summary
            style={{ cursor: "pointer", color: "#155724", userSelect: "none" }}
          >
            valid: {passingEntries.length} constraint
            {passingEntries.length !== 1 ? "s" : ""}
          </summary>
          <Box flex="y" spacing="xs" style={{ marginTop: "4px" }}>
            {passingEntries.map(([name]) => (
              <Box key={name} flex spacing="s" style={{ color: "#155724" }}>
                <span>✓</span>
                <span>{name}</span>
              </Box>
            ))}
          </Box>
        </details>
      )}
    </Box>
  );
};
