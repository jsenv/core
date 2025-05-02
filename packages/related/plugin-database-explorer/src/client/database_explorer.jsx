// TODO: SPA
// ability to get the list of tables (everything for now)
// and so on
// https://tanstack.com/table/v8/docs/framework/react/examples/basic

import { render } from "preact";
import { signal, effect } from "@preact/signals";
import { Table } from "./table.jsx";

const tablePublicFilterSignal = signal(false);
const tableArraySignal = signal([]);

effect(async () => {
  const tablePublicFilter = tablePublicFilterSignal.value;
  const response = await fetch(
    `/.internal/database/api/tables?public=${tablePublicFilter}`,
  );
  const tables = await response.json();
  tableArraySignal.value = tables;
});

const App = () => {
  const tablePublicFilter = tablePublicFilterSignal.value;

  return (
    <div>
      <h1>Database Explorer</h1>
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

const columns = [
  {
    accessor: "schemaname",
    cell: (info) => info.getValue(),
    footer: (info) => info.column.id,
  },
  {
    accessor: "tablename",
    id: "Name",
    cell: (info) => <i>{info.getValue()}</i>,
    header: () => <span>Name</span>,
    footer: (info) => info.column.id,
  },
  {
    accessor: "tableowner",
    header: () => "Owner",
    cell: (info) => info.renderValue(),
    footer: (info) => info.column.id,
  },
  {
    accessor: "tablespace",
    header: () => <span>Table space</span>,
    footer: (info) => info.column.id,
  },
  {
    accessor: "hasindexes",
    header: () => "Has indexes",
    footer: (info) => info.column.id,
  },
  {
    accessor: "hasrules",
    header: () => "Has rules",
    footer: (info) => info.column.id,
  },
  {
    accessor: "hastriggers",
    header: () => "Has triggers",
    footer: (info) => info.column.id,
  },
  {
    accessor: "rowsecurity",
    header: () => "Row security",
    footer: (info) => info.column.id,
  },
];

const TableList = () => {
  const tableArray = tableArraySignal.value;
  return <Table columns={columns} data={tableArray} />;
};

render(<App />, document.querySelector("#app"));
