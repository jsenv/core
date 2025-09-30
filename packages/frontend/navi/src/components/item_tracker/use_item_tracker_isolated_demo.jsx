import { useRef, useState } from "preact/hooks";
import {
  useItemTrackerIsolated,
  useTrackItem,
  useTrackedItem,
  useTrackedItems,
} from "./use_item_tracker_isolated.jsx";

// Initial state
const initialState = {
  renderKey: 0,
  items: [
    { id: "a", name: "First", color: "red" },
    { id: "b", name: "Second", color: "blue" },
  ],
};
export const App = () => {
  const [state, setState] = useState(initialState);

  log(`🎬 App render ${state.renderKey}`);

  const handleUpdateItem = (index, newItem) => {
    setState((prev) => {
      const newItems = [...prev.items];
      newItems[index] = newItem;
      log(`🔄 Updated item ${index}: ${JSON.stringify(newItem)}`);
      return { ...prev, items: newItems };
    });
  };

  const handleRemoveItem = (index) => {
    setState((prev) => {
      const newItems = prev.items.filter((_, i) => i !== index);
      log(`➖ Removed item ${index}`);
      return { ...prev, items: newItems };
    });
  };

  const handleAddAfter = (index) => {
    setState((prev) => {
      const newId = String.fromCharCode(97 + prev.items.length);
      const newItem = {
        id: newId,
        name: `Item ${newId.toUpperCase()}`,
        color: "green",
      };
      const newItems = [
        ...prev.items.slice(0, index + 1),
        newItem,
        ...prev.items.slice(index + 1),
      ];
      log(`➕ Added item after ${index}: ${JSON.stringify(newItem)}`);
      return { ...prev, items: newItems };
    });
  };

  const [ItemProducerProvider, ItemConsumerProvider] = useItemTrackerIsolated();

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
      </div>

      <div className="section">
        <h3>App Data Controls (affects both producer & consumer)</h3>
        {state.items.map((item, index) => (
          <AppDataControls
            key={`${item.id}-${state.renderKey}`}
            item={item}
            index={index}
            onUpdate={handleUpdateItem}
            onRemove={handleRemoveItem}
            onAddAfter={handleAddAfter}
          />
        ))}
      </div>

      <Producer state={state} ItemProducerProvider={ItemProducerProvider} />
      <Consumer ItemConsumerProvider={ItemConsumerProvider} />
    </div>
  );
};

const Producer = ({ state, ItemProducerProvider }) => {
  return (
    <ItemProducerProvider>
      <div className="section">
        <h3>Producer Items (with local overrides)</h3>
        {state.items.map((item) => (
          <ProducerItem
            key={`${item.id}-${state.renderKey}`}
            id={item.id}
            name={item.name}
            color={item.color}
          />
        ))}
      </div>
    </ItemProducerProvider>
  );
};

const Consumer = ({ ItemConsumerProvider }) => {
  return (
    <ItemConsumerProvider>
      <div className="section">
        <h3>Item Consumers</h3>
        <ItemConsumer itemIndex={0} />
        <ItemConsumer itemIndex={1} />
        <ItemConsumer itemIndex={2} />
        <ItemConsumer itemIndex={3} />
      </div>

      <div className="section">
        <ValuesDisplay />
      </div>
    </ItemConsumerProvider>
  );
};

// Producer item with local state for testing overrides
const ProducerItem = ({ id, name, color: initialColor }) => {
  const [localColor, setLocalColor] = useState(initialColor);
  const outColorRef = useRef(initialColor);
  if (outColorRef.current !== initialColor) {
    outColorRef.current = initialColor;
    setLocalColor(initialColor);
  }
  const [renderKey, setRenderKey] = useState(0);
  const colors = ["red", "blue", "green", "purple", "orange", "pink"];

  // Track the item with current local state
  const itemIndex = useTrackItem({ id, name, color: localColor });

  log(`🎨 Producer item ${id} render, ${localColor}`);

  return (
    <div className="item-data">
      <div className="item-info">
        <strong>Producer Item {itemIndex}:</strong> id={id}, name={name}, color=
        {localColor}
        <small> (render #{renderKey})</small>
      </div>
      <div className="item-controls">
        <select
          value={localColor}
          onChange={(e) => {
            log(
              `🎨 Producer override: ${id} color changed to ${e.target.value}`,
            );
            setLocalColor(e.target.value);
          }}
        >
          {colors.map((color) => (
            <option key={color} value={color}>
              {color}
            </option>
          ))}
        </select>
        <button
          className="rerender"
          onClick={() => {
            log(`🔄 Re-rendering producer item ${id}`);
            setRenderKey((prev) => prev + 1);
          }}
        >
          Re-render Producer
        </button>
        <button
          onClick={() => {
            log(`🔄 Reset producer item ${id} to original color`);
            setLocalColor(initialColor);
          }}
        >
          Reset Color
        </button>
      </div>
    </div>
  );
};

// App data controls that affect the global state
const AppDataControls = ({ item, index, onUpdate, onRemove, onAddAfter }) => {
  const colors = ["red", "blue", "green", "purple", "orange", "pink"];

  return (
    <div className="item-data">
      <div className="item-info">
        <strong>App Data {index}:</strong> id={item.id}, name={item.name},
        color=
        {item.color}
      </div>
      <div className="item-controls">
        <select
          value={item.color}
          onChange={(e) => onUpdate(index, { ...item, color: e.target.value })}
        >
          {colors.map((color) => (
            <option key={color} value={color}>
              {color}
            </option>
          ))}
        </select>
        <button className="add" onClick={() => onAddAfter(index)}>
          Add After
        </button>
        <button className="remove" onClick={() => onRemove(index)}>
          Remove
        </button>
      </div>
    </div>
  );
};

// Item consumer with re-render button
const ItemConsumer = ({ itemIndex }) => {
  const [renderKey, setRenderKey] = useState(0);
  const itemData = useTrackedItem(itemIndex);
  log(`👁️ Consumer ${itemIndex} render, ${itemData?.color}`);

  return (
    <div className="item-consumer">
      <div>
        <strong>Consumer for index {itemIndex}:</strong>
        <span>{itemData ? JSON.stringify(itemData) : "undefined"}</span>
        <small> (render #{renderKey})</small>
      </div>
      <button
        className="rerender"
        onClick={() => {
          log(`🔄 Re-rendering consumer ${itemIndex}`);
          setRenderKey((prev) => prev + 1);
        }}
      >
        Re-render
      </button>
    </div>
  );
};

// Values display
const ValuesDisplay = () => {
  const items = useTrackedItems();
  return (
    <div
      style={{
        background: "#fff3e0",
        padding: "10px",
        borderRadius: "4px",
      }}
    >
      <strong>All Tracked Items:</strong>
      <pre>{JSON.stringify(items, null, 2)}</pre>
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
