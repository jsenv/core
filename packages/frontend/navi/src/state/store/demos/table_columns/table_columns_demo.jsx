import { ActionRenderer, Button, resource } from "@jsenv/navi";
import { render } from "preact";

const columnsStore = [
  {
    column_name: "id",
  },
  {
    column_name: "email",
  },
  {
    column_name: "name",
  },
];
const COLUMN = resource("column", {
  idKey: "column_name",

  GET: ({ column_name }) => {
    const column = columnsStore.find((c) => c.column_name === column_name);
    if (!column) {
      throw new Error(`Column "${column_name}" not found`);
    }
    return { ...column };
  },

  PUT: ({ column_name, property, value }) => {
    const column = columnsStore.find((c) => c.column_name === column_name);
    if (!column) {
      throw new Error(`Column "${column_name}" not found`);
    }
    column[property] = value;
    return ["column_name", column_name, { [property]: value }];
  },
});
const TABLE = resource("table", {
  idKey: "id",

  GET: ({ id }) => ({
    id,
    columns: [...columnsStore],
  }),
});
TABLE.many("columns", COLUMN);

const tableAction = TABLE.GET.bindParams({ id: "users" });

const ColumnRow = ({ column }) => {
  return (
    <li>
      <code>{column.column_name}</code>
      <Button
        action={() => {
          COLUMN.PUT({
            column_name: column.column_name,
            property: `column_name`,
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
        <ColumnRow key={col.id} column={col} />
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
