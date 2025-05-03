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

const TableList = () => {
  const { columns, data } = tableInfoSignal.value;
  columns.sort((a, b) => {
    return a.ordinal_position - b.ordinal_position;
  });
  const tableColumns = columns.map((column) => {
    return {
      accessorKey: column.column_name,
      header: () => <span>{column.column_name}</span>,
      cell: (info) => {
        const value = info.getValue();
        return String(value);
      },
      footer: (info) => info.column.id,
    };
  });

  return <Table columns={tableColumns} data={data} />;
};

render(<App />, document.querySelector("#app"));
