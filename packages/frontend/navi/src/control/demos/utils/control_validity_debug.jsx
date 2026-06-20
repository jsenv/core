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
      spacing="s"
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
      <Box
        flex
        spacing="s"
        style={{
          fontWeight: "bold",
          color: state.valid ? "#155724" : "#721c24",
        }}
      >
        <span>{state.valid ? "✅" : "❌"}</span>
        <span>validity: {state.valid ? "valid" : "invalid"}</span>
      </Box>

      {committedValue !== undefined && (
        <Box flex spacing="s" style={{ color: "#007bff" }}>
          <span>💾</span>
          <span>committed: {JSON.stringify(committedValue)}</span>
        </Box>
      )}

      {failingEntries.map(([name, info]) => (
        <Box key={name} flex spacing="s" style={{ color: "#721c24" }}>
          <span>✗</span>
          <span>
            {name}
            {info && info.messageString ? `: ${info.messageString}` : ""}
          </span>
        </Box>
      ))}

      {passingEntries.map(([name]) => (
        <Box key={name} flex spacing="s" style={{ color: "#155724" }}>
          <span>✓</span>
          <span>{name}</span>
        </Box>
      ))}
    </Box>
  );
};
