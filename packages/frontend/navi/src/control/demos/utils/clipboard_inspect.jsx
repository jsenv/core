import { useState } from "preact/hooks";

const INSPECT_TYPES = ["text/plain", "application/x-navi"];

export const ClipboardInspect = ({ children }) => {
  const [clipEntries, setClipEntries] = useState(null);

  const onPaste = (e) => {
    e.preventDefault();
    const entries = INSPECT_TYPES.map((type) => ({
      type,
      value: e.clipboardData.getData(type),
    }));
    setClipEntries(entries);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {children}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <span
          style={{ fontSize: "13px", color: "#888", fontFamily: "monospace" }}
        >
          Paste here to inspect clipboard content
        </span>
        <textarea
          rows={2}
          style={{
            fontFamily: "monospace",
            fontSize: "13px",
            width: "100%",
            boxSizing: "border-box",
            padding: "6px 8px",
            border: "1px solid #ccc",
            borderRadius: "4px",
          }}
          placeholder="paste here…"
          onPaste={onPaste}
        />
        {clipEntries ? (
          <table
            style={{
              borderCollapse: "collapse",
              fontSize: "13px",
              width: "100%",
            }}
          >
            {clipEntries.map(({ type, value }) => (
              <tr key={type} style={{ borderTop: "1px solid #e8e8e8" }}>
                <td
                  style={{
                    padding: "4px 10px 4px 0",
                    fontFamily: "monospace",
                    color: "#888",
                    whiteSpace: "nowrap",
                    verticalAlign: "top",
                  }}
                >
                  {type}
                </td>
                <td
                  style={{
                    padding: "4px 0",
                    fontFamily: "monospace",
                    wordBreak: "break-all",
                  }}
                >
                  {value ? (
                    JSON.stringify(value)
                  ) : (
                    <span style={{ color: "#bbb" }}>(empty)</span>
                  )}
                </td>
              </tr>
            ))}
          </table>
        ) : null}
      </div>
    </div>
  );
};
