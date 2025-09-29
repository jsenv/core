import { useState } from "preact/hooks";
import {
  useGetAllItems,
  useGetItem,
  useRegisterItem,
  useSimpleItemTracker,
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
    const categories = ["Type A", "Type B", "Type C"];
    const newId = String.fromCharCode(97 + rows.length);

    const newRow = {
      id: newId,
      name: `Row ${newId.toUpperCase()}`,
      color: colors[Math.floor(Math.random() * colors.length)],
      category: categories[Math.floor(Math.random() * categories.length)],
      value: Math.floor(Math.random() * 500) + 100,
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
                  <th>Value</th>
                  <th>Color</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((rowData) => (
                  <TableRow key={rowData.id} rowData={rowData}>
                    {({ rowIndex }) => (
                      <>
                        <TableCell rowIndex={rowIndex} column="name" />
                        <TableCell rowIndex={rowIndex} column="category" />
                        <TableCell rowIndex={rowIndex} column="value" />
                        <TableCell rowIndex={rowIndex} column="color" />
                      </>
                    )}
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

// Demo components
const TableRow = ({ rowData, children }) => {
  // Register this row and get its index
  const rowIndex = useRegisterItem(rowData);

  log(`🎬 TableRow ${rowIndex} render (${rowData.name})`);

  return (
    <tr className={`table-row table-row--${rowData.color}`}>
      {children({ rowIndex, rowData })}
    </tr>
  );
};

const TableCell = ({ rowIndex, column }) => {
  // Get the row data by index
  const rowData = useGetItem(rowIndex);

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
  const allItems = useGetAllItems();

  return (
    <div className="tracked-rows">
      <strong>All Tracked Rows ({allItems.length}):</strong>
      {allItems.map((item, index) => (
        <div key={index} className="tracked-row-item">
          <span>
            #{index}: {item.name}
          </span>
          <span style={{ color: item.color, fontWeight: "bold" }}>
            {item.color}
          </span>
        </div>
      ))}
      {allItems.length === 0 && (
        <div style={{ opacity: 0.6, fontStyle: "italic" }}>
          No rows tracked yet
        </div>
      )}
    </div>
  );
};
