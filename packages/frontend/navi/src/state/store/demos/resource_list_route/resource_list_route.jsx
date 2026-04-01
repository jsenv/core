import { Link, Nav, resource, Route, route, setupRoutes } from "@jsenv/navi";
import { render } from "preact";

const HOME_ROUTE = route("");
const LIST_ROUTE = route("/list");
setupRoutes([HOME_ROUTE, LIST_ROUTE]);

let nextId = 1;
const itemStore = new Map();

// Pre-populate with a few items
for (let i = 0; i < 3; i++) {
  const id = String(nextId++);
  itemStore.set(id, { id });
}

const ITEM = resource("item", {
  idKey: "id",

  GET_MANY: () => {
    return Array.from(itemStore.values());
  },

  POST: ({ id }) => {
    const item = { id };
    itemStore.set(id, item);
    return item;
  },

  DELETE: ({ id }) => {
    const item = itemStore.get(id);
    if (!item) {
      throw new Error(`Item ${id} not found`);
    }
    itemStore.delete(id);
    return item;
  },
});

// Load the list immediately so dataSignal is populated
ITEM.GET_MANY.run();

const addItem = () => {
  const id = String(nextId++);
  ITEM.POST({ id });
};

const deleteItem = (id) => {
  ITEM.DELETE({ id });
};

const App = () => (
  <div>
    <Nav
      style={{
        display: "flex",
        gap: "8px",
        padding: "12px 16px",
        borderBottom: "1px solid #dee2e6",
      }}
    >
      <Link route={HOME_ROUTE}>Home</Link>
      <Link route={LIST_ROUTE}>List</Link>
    </Nav>
    <Route id="app">
      <Route route={HOME_ROUTE} element={HomePage} />
      <Route
        route={LIST_ROUTE}
        action={ITEM.GET_MANY}
        element={(items) => <ItemList items={items} />}
      />
    </Route>
  </div>
);

const HomePage = () => (
  <div
    style={{
      maxWidth: "400px",
      margin: "40px auto",
      fontFamily: "system-ui, sans-serif",
    }}
  >
    <h2>Home</h2>
    <p style={{ color: "#6c757d" }}>Navigate to the list to see items.</p>
  </div>
);

const ItemList = ({ items }) => (
  <div
    style={{
      maxWidth: "400px",
      margin: "40px auto",
      fontFamily: "system-ui, sans-serif",
    }}
  >
    <h2 style={{ marginBottom: "16px" }}>Items</h2>

    <ul
      style={{
        listStyle: "none",
        padding: 0,
        margin: "0 0 12px",
        border: "1px solid #dee2e6",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      {items.length === 0 ? (
        <li
          style={{
            padding: "12px 16px",
            color: "#6c757d",
            fontStyle: "italic",
          }}
        >
          No items
        </li>
      ) : (
        items.map((item, index) => (
          <li
            key={item.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 12px",
              borderTop: index === 0 ? "none" : "1px solid #dee2e6",
              backgroundColor: "white",
            }}
          >
            <span style={{ fontFamily: "monospace" }}>#{item.id}</span>
            <button
              onClick={() => deleteItem(item.id)}
              style={{
                padding: "2px 8px",
                backgroundColor: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "0.8em",
              }}
            >
              🗑️
            </button>
          </li>
        ))
      )}
    </ul>

    <button
      onClick={addItem}
      style={{
        padding: "6px 16px",
        backgroundColor: "#28a745",
        color: "white",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
        fontSize: "0.9em",
      }}
    >
      + Add item
    </button>
  </div>
);

render(<App />, document.querySelector("#root"));
