import { ActionRenderer, resource } from "@jsenv/navi";
import { render } from "preact";
import { useState } from "preact/hooks";

const columnsStore = new Map([
  ["id", { id: "id", column_name: "id" }],
  ["email", { id: "email", column_name: "email" }],
  ["name", { id: "name", column_name: "name" }],
]);

const COLUMN = resource("column", {
  idKey: "id",
  mutableIdKeys: ["column_name"],

  GET: ({ id }) => {
    const column = columnsStore.get(id);
    if (!column) throw new Error(`Column "${id}" not found`);
    return { ...column };
  },

  PUT: ({ id, column_name: newName }) => {
    const column = columnsStore.get(id);
    if (!column) throw new Error(`Column "${id}" not found`);
    columnsStore.delete(id);
    column.column_name = newName;
    column.id = newName;
    columnsStore.set(newName, column);
    return { ...column };
  },
});

const TABLE = resource("table", {
  idKey: "id",

  GET: ({ id }) => ({
    id,
    columns: ["id", "email", "name"],
  }),
});

TABLE.many("columns", COLUMN);

const tableAction = TABLE.GET.bindParams({ id: "users" });

const ColumnRow = ({ column }) => {
  const [editing, setEditing] = useState(false);
  const renameAction = COLUMN.PUT.bindParams({ id: column.id });

  if (!editing) {
    return (
      <li>
        <code>{column.column_name}</code>
        <button onClick={() => setEditing(true)}>rename</button>
      </li>
    );
  }

  return (
    <li>
      <ActionRenderer action={renameAction}>
        {{
          always: ({ loading, completed }) => {
            if (completed) {
              setEditing(false);
              return null;
            }
            return (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const newName = e.target.elements.column_name.value.trim();
                  if (newName) renameAction.run({ column_name: newName });
                }}
              >
                <input
                  name="column_name"
                  defaultValue={column.column_name}
                  autoFocus
                  disabled={loading}
                />
                <button type="submit" disabled={loading}>
                  ok
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  disabled={loading}
                >
                  cancel
                </button>
              </form>
            );
          },
        }}
      </ActionRenderer>
    </li>
  );
};

const App = () => {
  return (
    <div>
      <ActionRenderer action={tableAction}>
        {(table) => (
          <ul>
            {table.columns.map((col) => (
              <ColumnRow key={col.id} column={col} />
            ))}
          </ul>
        )}
      </ActionRenderer>
    </div>
  );
};

render(<App />, document.getElementById("root"));
