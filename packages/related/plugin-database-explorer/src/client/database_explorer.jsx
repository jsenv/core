// TODO: SPA
// ability to get the list of tables (everything for now)
// and so on
// https://tanstack.com/table/v8/docs/framework/react/examples/basic

import { render } from "preact";
import { signal, effect } from "@preact/signals";
import { useTable } from "./use_table.js";
import { createColumnHelper, getCoreRowModel } from "@tanstack/table-core";
import "./database_explorer.css" with { type: "css" };

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

const columnHelper = createColumnHelper();
const columns = [
  columnHelper.accessor("schemaname", {
    cell: (info) => info.getValue(),
    footer: (info) => info.column.id,
  }),
  columnHelper.accessor((row) => row.tablename, {
    id: "Name",
    cell: (info) => <i>{info.getValue()}</i>,
    header: () => <span>Name</span>,
    footer: (info) => info.column.id,
  }),
  columnHelper.accessor("tableowner", {
    header: () => "Owner",
    cell: (info) => info.renderValue(),
    footer: (info) => info.column.id,
  }),
  columnHelper.accessor("tablespace", {
    header: () => <span>Table space</span>,
    footer: (info) => info.column.id,
  }),
  columnHelper.accessor("hasindexes", {
    header: () => "Has indexes",
    footer: (info) => info.column.id,
  }),
  columnHelper.accessor("hasrules", {
    header: () => "Has rules",
    footer: (info) => info.column.id,
  }),
  columnHelper.accessor("hastriggers", {
    header: () => "Has triggers",
    footer: (info) => info.column.id,
  }),
  columnHelper.accessor("rowsecurity", {
    header: () => "Row security",
    footer: (info) => info.column.id,
  }),
];

const TableList = () => {
  const tableArray = tableArraySignal.value;
  const { getHeaderGroups, getRowModel, getFooterGroups } = useTable({
    columns,
    data: tableArray,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <table>
      <thead>
        {getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th key={header.id}>
                {header.isPlaceholder ? null : (
                  <header.column.columnDef.header {...header.getContext()} />
                )}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <TableBody rows={getRowModel().rows} />
      <tfoot>
        {getFooterGroups().map((footerGroup) => (
          <tr key={footerGroup.id}>
            {footerGroup.headers.map((header) => (
              <th key={header.id}>
                {header.isPlaceholder ? null : (
                  <header.column.columnDef.footer {...header.getContext()} />
                )}
              </th>
            ))}
          </tr>
        ))}
      </tfoot>
    </table>
  );
};

const TableBody = ({ rows }) => {
  return (
    <tbody>
      {rows.map((row) => (
        <TableBodyRow key={row.id} cells={row.getVisibleCells()} />
      ))}
    </tbody>
  );
};
const TableBodyRow = ({ cells }) => {
  return (
    <tr>
      {cells.map((cell) => (
        <TableBodyCell key={cell.id} cell={cell} />
      ))}
    </tr>
  );
};
const TableBodyCell = ({ cell }) => {
  const CellComponent = cell.column.columnDef.cell;
  const cellProps = cell.getContext();
  return (
    <td>
      <CellComponent {...cellProps} />
    </td>
  );
};

render(<App />, document.querySelector("#app"));
