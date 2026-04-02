import { ActionRenderer, Button, resource } from "@jsenv/navi";
import { render } from "preact";

// Backend state
const tablesStore = {
  users: {
    id: "users",
    columns: [
      { column_name: "id" },
      { column_name: "email" },
      { column_name: "name" },
    ],
    settings: { theme: "light", page_size: 10 },
  },
};

const TABLE = resource("table", {
  idKey: "id",

  GET: ({ id }) => ({
    id: tablesStore[id].id,
    columns: [...tablesStore[id].columns],
    settings: { ...tablesStore[id].settings },
  }),
});

// .collection() — TABLE has many COLUMNS, each column owned by its table
const TABLE_COLUMNS = TABLE.collection("columns", {
  idKey: "column_name",

  PUT: ({ id, column_name, property, value }) => {
    const col = tablesStore[id].columns.find(
      (c) => c.column_name === column_name,
    );
    if (!col) throw new Error(`Column "${column_name}" not found in "${id}"`);
    col[property] = value;
    return [id, "column_name", column_name, { [property]: value }];
  },

  DELETE: ({ id, column_name }) => {
    const columns = tablesStore[id].columns;
    const idx = columns.findIndex((c) => c.column_name === column_name);
    if (idx === -1) throw new Error(`Column "${column_name}" not found`);
    columns.splice(idx, 1);
    return [id, column_name];
  },
});

// .item() — TABLE has a single SETTINGS object owned by it
const TABLE_SETTINGS = TABLE.item("settings", {
  PUT: ({ id, theme, page_size }) => {
    tablesStore[id].settings = { theme, page_size };
    return [id, { theme, page_size }];
  },
});

const tableAction = TABLE.GET.bindParams({ id: "users" });
tableAction.prerun();

const ColumnRow = ({ table, column }) => (
  <li>
    <code>{column.column_name}</code>
    <Button
      action={() =>
        TABLE_COLUMNS.PUT({
          id: table.id,
          column_name: column.column_name,
          property: "column_name",
          value: `${column.column_name}_2`,
        })
      }
    >
      rename
    </Button>
    <Button
      action={() =>
        TABLE_COLUMNS.DELETE({ id: table.id, column_name: column.column_name })
      }
    >
      delete
    </Button>
  </li>
);

const TableDisplay = ({ table }) => (
  <div>
    <h3>Columns</h3>
    <ul>
      {table.columns.map((col) => (
        <ColumnRow key={col.column_name} table={table} column={col} />
      ))}
    </ul>
    <h3>Settings</h3>
    <p>
      theme: <strong>{table.settings?.theme ?? "—"}</strong>, page_size:{" "}
      <strong>{table.settings?.page_size ?? "—"}</strong>
    </p>
    <Button
      action={() =>
        TABLE_SETTINGS.PUT({
          id: table.id,
          theme: "dark",
          page_size: 20,
        })
      }
    >
      set theme=dark, page_size=20
    </Button>
  </div>
);

const App = () => (
  <div>
    <button onClick={() => tableAction.rerun()}>reload table</button>
    <ActionRenderer action={tableAction}>
      {{
        idle: () => null,
        loading: () => <p>loading…</p>,
        completed: (table) => <TableDisplay table={table} />,
      }}
    </ActionRenderer>
  </div>
);

render(<App />, document.getElementById("root"));
