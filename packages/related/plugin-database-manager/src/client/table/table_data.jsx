/**
 * https://tanstack.com/table/latest/docs/framework/react/examples/basic?panel=code
 *
 */

import { Button, Input } from "@jsenv/navi";
import { useState } from "preact/hooks";
import { DatabaseField } from "../components/database_field.jsx";
import { Table } from "../components/table.jsx";

import.meta.css = /* css */ `
  .table_data_actions {
    margin-bottom: 15px;
  }
`;

export const TableData = ({ table, rows }) => {
  const [, setRowSelection] = useState({});

  const { schemaColumns } = table.meta;
  const selectColumn = {
    id: "select",
    header: ({ table }) => (
      <Input
        type="checkbox"
        checked={table.getIsAllRowsSelected()}
        indeterminate={table.getIsSomeRowsSelected()}
        onChange={table.getToggleAllRowsSelectedHandler()}
      />
    ),
    cell: ({ row }) => (
      <div className="px-1">
        <Input
          type="checkbox"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          indeterminate={row.getIsSomeSelected()}
          onChange={row.getToggleSelectedHandler()}
        />
      </div>
    ),
  };

  const columns = schemaColumns.map((column) => {
    const columnName = column.column_name;

    return {
      accessorKey: columnName,
      header: () => <span>{columnName}</span>,
      cell: (info) => {
        const value = info.getValue();
        const tableName = info.row.original.tablename;
        return (
          <DatabaseField
            tableName={tableName}
            column={column}
            action={null}
            value={value}
          />
        );
      },
      footer: (info) => info.column.id,
    };
  });

  return (
    <div>
      <div className="table_data_actions">
        <Button>Add row</Button>
      </div>
      <Table
        columns={[selectColumn, ...columns]}
        data={rows}
        onRowSelectionChange={(value) => {
          setRowSelection(value);
        }}
        style={{ height: "fit-content" }}
      />
    </div>
  );
};
