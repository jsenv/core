import { ActionRenderer, Button, resource } from "@jsenv/navi";
import { render } from "preact";
import { useState } from "preact/hooks";

const tablesStore = {
  users: [
    { column_name: "id" },
    { column_name: "email" },
    { column_name: "name" },
  ],
};

const TABLE = resource("table", {
  idKey: "id",

  GET: ({ id }) => ({
    id,
    columns: [...tablesStore[id]],
  }),
});

const TABLE_COLUMNS = TABLE.scopedMany("columns", {
  idKey: "column_name",

  POST: ({ id, column_name }) => {
    if (tablesStore[id].some((c) => c.column_name === column_name)) {
      throw new Error(
        `Column "${column_name}" already exists in table "${id}"`,
      );
    }
    const newColumn = { column_name };
    tablesStore[id].push(newColumn);
    return [id, newColumn];
  },

  PUT: ({ id, column_name, property, value }) => {
    const column = tablesStore[id].find((c) => c.column_name === column_name);
    if (!column) {
      throw new Error(`Column "${column_name}" not found in table "${id}"`);
    }
    column[property] = value;
    return [id, "column_name", column_name, { [property]: value }];
  },
});

const tableAction = TABLE.GET.bindParams({ id: "users" });

const ColumnRow = ({ table, column }) => {
  return (
    <li>
      <code>{column.column_name}</code>
      <Button
        action={() => {
          TABLE_COLUMNS.PUT({
            id: table.id,
            column_name: column.column_name,
            property: "column_name",
            value: `${column.column_name}_2`,
          });
        }}
      >
        rename
      </Button>
    </li>
  );
};

tableAction.prerun();

const TableDisplay = ({ table }) => {
  const [newColName, setNewColName] = useState("");
  return (
    <div>
      <ul>
        {table.columns.map((col) => (
          <ColumnRow key={col.column_name} table={table} column={col} />
        ))}
      </ul>
      <div>
        <input
          type="text"
          placeholder="new column name"
          value={newColName}
          onInput={(e) => setNewColName(e.target.value)}
        />
        <Button
          action={() => {
            const name = newColName.trim();
            if (!name) return;
            TABLE_COLUMNS.POST({ id: table.id, column_name: name });
            setNewColName("");
          }}
        >
          + add column
        </Button>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <div>
      <button onClick={() => tableAction.rerun()}>reload table columns</button>
      <ActionRenderer action={tableAction}>
        {{
          idle: () => null,
          loading: () => <p>loading…</p>,
          completed: (table) => <TableDisplay table={table} />,
        }}
      </ActionRenderer>
    </div>
  );
};

render(<App />, document.querySelector("#root"));
