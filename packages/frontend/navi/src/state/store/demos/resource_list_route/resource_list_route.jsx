import { Link, Nav, Route, route, routeAction, setupRoutes } from "@jsenv/navi";
import { render } from "preact";

import { ITEM, addItem, deleteItem } from "./item_store.js";

const HOME_ROUTE = route("");
const LIST_ROUTE = route("/list");
setupRoutes([HOME_ROUTE, LIST_ROUTE]);

const ITEM_GET_MANY_ACTION = routeAction(LIST_ROUTE, ITEM.GET_MANY);

const App = () => (
  <div>
    <Nav spacing="m">
      <Link route={HOME_ROUTE} appearance="tab" currentIndicator padding="s">
        Home
      </Link>
      <Link route={LIST_ROUTE} appearance="tab" currentIndicator padding="s">
        List
      </Link>
    </Nav>
    <Route id="app">
      <Route route={HOME_ROUTE} element={HomePage} />
      <Route
        route={LIST_ROUTE}
        action={ITEM_GET_MANY_ACTION}
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
