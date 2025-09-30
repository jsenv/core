import { useRef, useState } from "preact/hooks";
import { createIsolatedItemTracker } from "./use_isolated_item_tracker.jsx";

// Initial state for table columns
const initialState = {
  renderKey: 0,
  columns: [
    { id: "name", label: "Name", width: "200px", sortable: true },
    { id: "email", label: "Email", width: "250px", sortable: true },
    { id: "status", label: "Status", width: "100px", sortable: false },
  ],
  tableData: [
    { name: "John Doe", email: "john@example.com", status: "Active" },
    { name: "Jane Smith", email: "jane@example.com", status: "Inactive" },
    { name: "Bob Johnson", email: "bob@example.com", status: "Pending" },
  ],
};

const [useColumnTrackerProviders, useRegisterColumn, useColumn, useColumns] =
  createIsolatedItemTracker();

export const App = () => {
  const [state, setState] = useState(initialState);

  log(`🎬 App render ${state.renderKey}`);

  const handleUpdateColumn = (index, newColumn) => {
    setState((prev) => {
      const newColumns = [...prev.columns];
      newColumns[index] = newColumn;
      log(`🔄 Updated column ${index}: ${JSON.stringify(newColumn)}`);
      return { ...prev, columns: newColumns };
    });
  };

  const handleRemoveColumn = (index) => {
    setState((prev) => {
      const newColumns = prev.columns.filter((_, i) => i !== index);
      log(`➖ Removed column ${index}`);
      return { ...prev, columns: newColumns };
    });
  };

  const handleAddColumn = () => {
    setState((prev) => {
      const newId = `col${prev.columns.length + 1}`;
      const newColumn = {
        id: newId,
        label: `Column ${prev.columns.length + 1}`,
        width: "150px",
        sortable: true,
      };
      log(`➕ Added column: ${JSON.stringify(newColumn)}`);
      return { ...prev, columns: [...prev.columns, newColumn] };
    });
  };

  const [ColumnProducerProvider, ColumnConsumerProvider] =
    useColumnTrackerProviders();

  return (
    <div>
      <div style={{ marginBottom: "20px" }}>
        <strong>App Render #{state.renderKey}</strong>
        <button
          style={{ marginLeft: "10px" }}
          onClick={() => {
            log("🔄 Manual app re-render triggered");
            setState((prev) => ({
              ...prev,
              renderKey: prev.renderKey + 1,
            }));
          }}
        >
          Re-render App
        </button>
        <button style={{ marginLeft: "10px" }} onClick={handleAddColumn}>
          ➕ Add Column
        </button>
      </div>

      <div className="section">
        <h3>Column Configuration (affects both producer & consumer)</h3>
        {state.columns.map((column, index) => (
          <ColumnDataControls
            key={`${column.id}-${state.renderKey}`}
            column={column}
            index={index}
            onUpdate={handleUpdateColumn}
            onRemove={handleRemoveColumn}
          />
        ))}
      </div>

      {/* Producer: Table with colgroup that registers columns */}
      <TableProducer
        state={state}
        ColumnProducerProvider={ColumnProducerProvider}
      />

      {/* Consumer: Components that read column data */}
      <ColumnConsumers ColumnConsumerProvider={ColumnConsumerProvider} />
    </div>
  );
};

// Producer: Table with colgroup that registers columns
const TableProducer = ({ state, ColumnProducerProvider }) => {
  return (
    <ColumnProducerProvider>
      <div className="section">
        <h3>🏗️ Producer: Table with Column Registration</h3>
        <p style={{ fontSize: "12px", margin: "0 0 10px 0", color: "#666" }}>
          💡 The colgroup below registers column definitions. Change widths to
          trigger individual column re-renders.
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          {/* This colgroup registers the columns - this is the PRODUCER */}
          <colgroup>
            {state.columns.map((column) => (
              <ColumnDefinition
                key={`${column.id}-${state.renderKey}`}
                id={column.id}
                label={column.label}
                width={column.width}
                sortable={column.sortable}
              />
            ))}
          </colgroup>
          <thead>
            <tr>
              {state.columns.map((column) => (
                <th
                  key={column.id}
                  style={{
                    border: "1px solid #ddd",
                    padding: "8px",
                    background: "#f5f5f5",
                  }}
                >
                  {column.label}
                  {column.sortable && " ↕️"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.tableData.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {state.columns.map((column) => (
                  <td
                    key={column.id}
                    style={{ border: "1px solid #ddd", padding: "8px" }}
                  >
                    {row[column.id] || `row${rowIndex}-${column.id}`}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ColumnProducerProvider>
  );
};

// Consumer: Components that read column data
const ColumnConsumers = ({ ColumnConsumerProvider }) => {
  return (
    <ColumnConsumerProvider>
      <div className="section">
        <h3>👁️ Consumers: Components Reading Column Data</h3>
        <p style={{ fontSize: "12px", margin: "0 0 10px 0", color: "#666" }}>
          These components read column data by index. They re-render when column
          data changes.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
          <ColumnConsumer columnIndex={0} />
          <ColumnConsumer columnIndex={1} />
          <ColumnConsumer columnIndex={2} />
          <ColumnConsumer columnIndex={3} />
        </div>
      </div>

      <div className="section">
        <h3>📊 All Tracked Columns</h3>
        <AllColumnsDisplay />
      </div>
    </ColumnConsumerProvider>
  );
};

// Column definition component with local state for testing overrides
const ColumnDefinition = ({ id, label, width: initialWidth, sortable }) => {
  const [localWidth, setLocalWidth] = useState(initialWidth);
  const [localSortable, setLocalSortable] = useState(sortable);
  const outWidthRef = useRef(initialWidth);
  const outSortableRef = useRef(sortable);

  // Reset local state when props change
  if (outWidthRef.current !== initialWidth) {
    outWidthRef.current = initialWidth;
    setLocalWidth(initialWidth);
  }
  if (outSortableRef.current !== sortable) {
    outSortableRef.current = sortable;
    setLocalSortable(sortable);
  }

  const [renderKey, setRenderKey] = useState(0);

  // Register the column with current local state
  const columnIndex = useRegisterColumn({
    id,
    label,
    width: localWidth,
    sortable: localSortable,
  });

  log(`�️ Column producer ${id} (index ${columnIndex}) render`);

  const widthOptions = ["100px", "150px", "200px", "250px", "300px"];

  return (
    <>
      <col style={{ width: localWidth }} />
      <div className="column-producer-controls">
        <div className="item-info">
          <strong>Column Producer {columnIndex}:</strong> id={id}, label={label}
          , width={localWidth}, sortable={localSortable ? "yes" : "no"}
          <small> (render #{renderKey})</small>
        </div>
        <div className="item-controls">
          <select
            value={localWidth}
            onChange={(e) => {
              log(
                `📏 Column ${id} width changed to ${e.target.value} (local override)`,
              );
              setLocalWidth(e.target.value);
            }}
          >
            {widthOptions.map((width) => (
              <option key={width} value={width}>
                {width}
              </option>
            ))}
          </select>
          <label style={{ marginLeft: "10px" }}>
            <input
              type="checkbox"
              checked={localSortable}
              onChange={(e) => {
                log(`🔄 Column ${id} sortable changed to ${e.target.checked}`);
                setLocalSortable(e.target.checked);
              }}
            />
            Sortable
          </label>
          <button
            className="rerender"
            onClick={() => {
              log(`🔄 Re-rendering column producer ${id}`);
              setRenderKey((prev) => prev + 1);
            }}
          >
            Re-render Producer
          </button>
          <button
            onClick={() => {
              log(`🔄 Reset column ${id} to original state`);
              setLocalWidth(initialWidth);
              setLocalSortable(sortable);
            }}
          >
            Reset
          </button>
        </div>
      </div>
    </>
  );
};

// Column data controls that affect the global state
const ColumnDataControls = ({ column, index, onUpdate, onRemove }) => {
  const widthOptions = ["100px", "150px", "200px", "250px", "300px"];

  return (
    <div className="item-data">
      <div className="item-info">
        <strong>App Column {index}:</strong> id={column.id}, label=
        {column.label}, width={column.width}, sortable=
        {column.sortable ? "yes" : "no"}
      </div>
      <div className="item-controls">
        <input
          value={column.label}
          onChange={(e) =>
            onUpdate(index, { ...column, label: e.target.value })
          }
          placeholder="Column label"
          style={{ marginRight: "5px" }}
        />
        <select
          value={column.width}
          onChange={(e) =>
            onUpdate(index, { ...column, width: e.target.value })
          }
        >
          {widthOptions.map((width) => (
            <option key={width} value={width}>
              {width}
            </option>
          ))}
        </select>
        <label style={{ margin: "0 10px" }}>
          <input
            type="checkbox"
            checked={column.sortable}
            onChange={(e) =>
              onUpdate(index, { ...column, sortable: e.target.checked })
            }
          />
          Sortable
        </label>
        <button className="remove" onClick={() => onRemove(index)}>
          Remove
        </button>
      </div>
    </div>
  );
};

// Column consumer with re-render button
const ColumnConsumer = ({ columnIndex }) => {
  const [renderKey, setRenderKey] = useState(0);
  const columnData = useColumn(columnIndex);
  log(`👁️ Consumer ${columnIndex} render, ${columnData?.label}`);

  return (
    <div className="item-consumer">
      <div>
        <strong>Consumer for column {columnIndex}:</strong>
        <div style={{ fontSize: "11px", marginTop: "4px" }}>
          {columnData ? (
            <div>
              <div>ID: {columnData.id}</div>
              <div>Label: {columnData.label}</div>
              <div>Width: {columnData.width}</div>
              <div>Sortable: {columnData.sortable ? "yes" : "no"}</div>
            </div>
          ) : (
            "undefined"
          )}
        </div>
        <small> (render #{renderKey})</small>
      </div>
      <button
        className="rerender"
        onClick={() => {
          log(`🔄 Re-rendering column consumer ${columnIndex}`);
          setRenderKey((prev) => prev + 1);
        }}
      >
        Re-render
      </button>
    </div>
  );
};

// All columns display
const AllColumnsDisplay = () => {
  const columns = useColumns();
  return (
    <div
      style={{
        background: "#fff3e0",
        padding: "10px",
        borderRadius: "4px",
      }}
    >
      <strong>All Tracked Columns ({columns.length}):</strong>
      <pre style={{ fontSize: "11px", margin: "8px 0 0 0" }}>
        {JSON.stringify(columns, null, 2)}
      </pre>
    </div>
  );
};

// Debug logging
const log = (message) => {
  const timestamp = new Date().toLocaleTimeString();
  const logElement = document.getElementById("logs");
  logElement.textContent += `[${timestamp}] ${message}\n`;
  logElement.scrollTop = logElement.scrollHeight;
  console.log(message);
};
