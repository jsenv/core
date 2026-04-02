import { ActionRenderer, Button, resource } from "@jsenv/navi";
import { render } from "preact";

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

const TABLE_COLUMNS = TABLE.ownMany("columns", {
  idKey: "column_name",

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
  return (
    <ul>
      {table.columns.map((col) => (
        <ColumnRow key={col.column_name} table={table} column={col} />
      ))}
    </ul>
  );
};

const App = () => {
  return (
    <div>
      <button onClick={() => tableAction.rerun()}>load users table</button>
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

render(<App />, document.getElementById("root"));
