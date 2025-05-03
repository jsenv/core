// TODO: SPA
// ability to get the list of tables (everything for now)
// and so on
// https://tanstack.com/table/v8/docs/framework/react/examples/basic

import { render } from "preact";
import { signal, effect } from "@preact/signals";
import { Table } from "./table.jsx";

const tablePublicFilterSignal = signal(false);
const tableInfoSignal = signal({ columns: [], data: [] });

effect(async () => {
  const tablePublicFilter = tablePublicFilterSignal.value;
  const response = await fetch(
    `/.internal/database/api/tables?public=${tablePublicFilter}`,
  );
  const tables = await response.json();
  tableInfoSignal.value = tables;
});

const updateTableName = async (tableName, newName) => {
  await fetch(`/.internal/database/api/tables/${tableName}/name`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(newName),
  });
};

const App = () => {
  const tablePublicFilter = tablePublicFilterSignal.value;

  return (
    <div>
      <h1>Database Manager</h1>
      <p>Explore and manage your database.</p>

      <form>
        <label>
          <input
            type="checkbox"
            checked={tablePublicFilter}
            onChange={(e) => {
              if (e.target.checked) {
                tablePublicFilterSignal.value = true;
              } else {
                tablePublicFilterSignal.value = false;
              }
            }}
          ></input>
          Public
        </label>
      </form>

      <TableList />
    </div>
  );
};

const TableNameCell = ({ name }) => {
  return (
    <div>
      <span>{name}</span>
    </div>
  );
};

const BooleanCell = ({ checked }) => {
  return (
    <form>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          if (e.target.checked) {
            // we need the fetch
          } else {
          }
        }}
        readOnly
      />
    </form>
  );
};

const CellDefaultComponent = ({ column, children }) => {
  if (column.name === "tablename") {
    return <TableNameCell name={children} />;
  }
  if (column.data_type === "boolean") {
    return <BooleanCell column={column} checked={children} />;
  }
  return String(children);
};

const TableList = () => {
  const { columns, data } = tableInfoSignal.value;
  columns.sort((a, b) => {
    return a.ordinal_position - b.ordinal_position;
  });
  const tableColumns = columns.map((column) => {
    const columnName = column.column_name;

    return {
      accessorKey: columnName,
      header: () => <span>{columnName}</span>,
      cell: (info) => {
        const value = info.getValue();
        debugger;
        return (
          <CellDefaultComponent column={column}>{value}</CellDefaultComponent>
        );
      },
      footer: (info) => info.column.id,
    };
  });

  return <Table columns={tableColumns} data={data} />;
};

render(<App />, document.querySelector("#app"));
