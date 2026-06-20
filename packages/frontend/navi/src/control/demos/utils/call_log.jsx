import { useEffect, useRef, useState } from "preact/hooks";

const css = /* css */ `
  .call-log {
    min-height: 28px;
    max-height: 120px;
    margin-top: 10px;
    padding: 8px 12px;
    font-size: 12px;
    font-family: monospace;
    background: #f9f9f9;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    overflow-y: auto;
  }
  .call-log-entry {
    display: flex;
    align-items: baseline;
    gap: 8px;
    line-height: 1.6;
  }
  .call-log-entry .count {
    min-width: 24px;
    color: #888;
    font-size: 11px;
  }
  .call-log-entry .label-ui {
    color: #c07000;
    font-weight: bold;
  }
  .call-log-entry .label-action {
    color: #1a56cc;
    font-weight: bold;
  }
  .call-log-entry .label-command {
    color: #1a8c5c;
    font-weight: bold;
  }
  .call-log-entry .label-other {
    color: #7a3ca3;
    font-weight: bold;
  }
  .call-log-entry .value {
    color: #333;
  }
  .call-log-summary {
    display: flex;
    margin-top: 6px;
    gap: 16px;
    color: #888;
    font-size: 11px;
    font-family: monospace;
  }
  .call-log-summary .summary-ui {
    color: #c07000;
  }
  .call-log-summary .summary-action {
    color: #1a56cc;
  }
  .call-log-summary .summary-command {
    color: #1a8c5c;
  }
  .call-log-summary .summary-other {
    color: #7a3ca3;
  }
  .call-log-header {
    display: flex;
    margin-top: 10px;
    margin-bottom: 2px;
    align-items: center;
    justify-content: space-between;
  }
  .call-log-clear {
    padding: 1px 8px;
    color: #888;
    font-size: 11px;
    font-family: monospace;
    background: none;
    border: 1px solid #ccc;
    border-radius: 4px;
    cursor: pointer;
  }
  .call-log-clear:hover {
    color: #555;
    background: #f0f0f0;
  }
`;

export const CallLog = ({ entries, onClear }) => {
  import.meta.css = css;
  const containerRef = useRef(null);
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [entries]);

  const uiActionCount = entries.filter((e) => e.type === "uiAction").length;
  const actionCount = entries.filter((e) => e.type === "action").length;
  const commandCount = entries.filter((e) => e.type === "command").length;
  const otherCounts = {};
  for (const entry of entries) {
    if (
      entry.type !== "uiAction" &&
      entry.type !== "action" &&
      entry.type !== "command"
    ) {
      otherCounts[entry.type] = (otherCounts[entry.type] || 0) + 1;
    }
  }

  if (entries.length === 0) {
    return (
      <div className="call-log" style="color: #aaa">
        No calls yet…
      </div>
    );
  }
  return (
    <div>
      <div className="call-log-header">
        <div className="call-log-summary">
          {uiActionCount > 0 && (
            <span className="summary-ui">uiAction: {uiActionCount}</span>
          )}
          {actionCount > 0 && (
            <span className="summary-action">action: {actionCount}</span>
          )}
          {commandCount > 0 && (
            <span className="summary-command">command: {commandCount}</span>
          )}
          {Object.entries(otherCounts).map(([type, count]) => (
            <span key={type} className="summary-other">
              {type}: {count}
            </span>
          ))}
        </div>
        {onClear && (
          <button className="call-log-clear" onClick={onClear}>
            clear
          </button>
        )}
      </div>
      <div className="call-log" ref={containerRef}>
        {entries.map((entry, i) => (
          <div key={i} className="call-log-entry">
            <span className="count">#{i + 1}</span>
            <span
              className={
                entry.type === "uiAction"
                  ? "label-ui"
                  : entry.type === "action"
                    ? "label-action"
                    : entry.type === "command"
                      ? "label-command"
                      : "label-other"
              }
            >
              {entry.type}
              {entry.eventType ? ` (${entry.eventType})` : ""}
            </span>
            <span className="value">← {formatValue(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
const formatValue = (value) => {
  if (value === undefined) {
    return "undefined";
  }
  return JSON.stringify(value);
};

export const useCallLog = () => {
  const [entries, setEntries] = useState([]);
  const push = (type, value, event) => {
    const eventType = event?.type;
    setEntries((prev) => [...prev, { type, value, eventType }]);
  };
  const clear = () => {
    setEntries([]);
  };
  return [entries, push, clear];
};
