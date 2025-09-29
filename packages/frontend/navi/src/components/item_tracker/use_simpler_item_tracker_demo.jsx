import { createContext } from "preact";
import { useContext, useState } from "preact/hooks";
import {
  useSimpleItemTracker,
  useTrackedItem,
  useTrackedItems,
  useTrackItem,
} from "./use_simple_item_tracker.jsx";

// Main demo app
export const App = () => {
  const [rows, setRows] = useState([
    {
      id: "a",
      name: "First Row",
      color: "red",
      category: "Type A",
      value: 100,
    },
    {
      id: "b",
      name: "Second Row",
      color: "blue",
      category: "Type B",
      value: 200,
    },
  ]);
  const [renderKey, setRenderKey] = useState(0);

  log(`🎬 App render #${renderKey}`);

  const SimpleItemTrackerProvider = useSimpleItemTracker();

  const addRow = () => {
    const colors = ["red", "blue", "green", "yellow"];
    const newId = String.fromCharCode(97 + rows.length);

    const newRow = {
      id: newId,
      name: `Row ${newId.toUpperCase()}`,
      color: colors[Math.floor(Math.random() * colors.length)],
    };

    setRows((prev) => [...prev, newRow]);
    log(`➕ Added row: ${JSON.stringify(newRow)}`);
  };

  const removeLastRow = () => {
    if (rows.length > 0) {
      const removed = rows[rows.length - 1];
      setRows((prev) => prev.slice(0, -1));
      log(`➖ Removed row: ${removed.name}`);
    }
  };

  const forceRerender = () => {
    setRenderKey((prev) => prev + 1);
    log(`🔄 Forced re-render #${renderKey + 1}`);
  };

  return (
    <div>
      <div className="section">
        <h3>🎮 Controls</h3>
        <div className="controls">
          <button className="btn btn--primary" onClick={addRow}>
            ➕ Add Row
          </button>
          <button className="btn" onClick={removeLastRow}>
            ➖ Remove Last Row
          </button>
          <button className="btn" onClick={forceRerender}>
            🔄 Force Re-render
          </button>
          <span style={{ fontSize: "11px", opacity: 0.7 }}>
            Render #{renderKey}
          </span>
        </div>
      </div>

      <SimpleItemTrackerProvider>
        <div className="section">
          <h3>📋 Table with Tracked Rows</h3>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ id, name, color }) => (
                  <TableRow key={id} name={name} color={color}>
                    <TableCell column="name" />
                    <TableCell column="color" />
                  </TableRow>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="section">
          <h3>🔍 Tracked Items Debug</h3>
          <TrackedRowsList />
        </div>
      </SimpleItemTrackerProvider>
    </div>
  );
};

// Simple logging
const logContainer = document.getElementById("log");
const log = (message) => {
  const timestamp = new Date().toLocaleTimeString();
  logContainer.textContent += `[${timestamp}] ${message}\n`;
  logContainer.scrollTop = logContainer.scrollHeight;
};

const TableRowIndexContext = createContext();

// Demo components
const TableRow = ({ children, name, color }) => {
  // Register this row and get its index
  const rowIndex = useTrackItem({ name, color });

  log(`🎬 TableRow ${rowIndex} render (${name})`);

  return (
    <tr className={`table-row table-row--${color}`}>
      <TableRowIndexContext.Provider value={rowIndex}>
        {children}
      </TableRowIndexContext.Provider>
    </tr>
  );
};

const TableCell = ({ column }) => {
  const rowIndex = useContext(TableRowIndexContext);
  const rowData = useTrackedItem(rowIndex);

  if (!rowData) {
    return <td>❌ Row {rowIndex} not found</td>;
  }

  const cellContent = rowData[column] || `${column}?`;

  return (
    <td title={`Row ${rowIndex}, Column ${column}`}>
      {cellContent}
      <small style={{ opacity: 0.6, marginLeft: "4px" }}>
        (row {rowIndex})
      </small>
    </td>
  );
};

const TrackedRowsList = () => {
  const rows = useTrackedItems();

  return (
    <div className="tracked-rows">
      <strong>All Tracked Rows ({rows.length}):</strong>
      {rows.map((item, index) => (
        <div key={index} className="tracked-row-item">
          <span>
            #{index}: {item.name}
          </span>
          <span style={{ color: item.color, fontWeight: "bold" }}>
            {item.color}
          </span>
        </div>
      ))}
      {rows.length === 0 && (
        <div style={{ opacity: 0.6, fontStyle: "italic" }}>
          No rows tracked yet
        </div>
      )}
    </div>
  );
};
