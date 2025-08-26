/**
 * https://tanstack.com/table/latest/docs/framework/react/examples/basic?panel=code
 *
 */

import { Button, Editable, Input, useEditableController } from "@jsenv/navi";
import { useState } from "preact/hooks";
import { useDatabaseInputProps } from "../components/database_field.jsx";
import { Table } from "../components/table.jsx";
import { TABLE_ROW } from "./table_store.js";

import.meta.css = /* css */ `
  .table_data_actions {
    margin-bottom: 15px;
  }
`;

export const TableData = ({ table, rows }) => {
  const tableName = table.tablename;
  const createRow = TABLE_ROW.POST.bindParams({ tablename: tableName });
  const [rowSelection, setRowSelection] = useState({});

  const { schemaColumns } = table.meta;
  const selectColumn = {
    id: "select",
    header: ({ table }) => (
      <Input
        type="checkbox"
        checked={table.getIsAllRowsSelected()}
        // indeterminate={table.getIsSomeRowsSelected()}
        onChange={table.getToggleAllRowsSelectedHandler()}
      />
    ),
    cell: ({ row }) => {
      const onChange = row.getToggleSelectedHandler();
      const checked = row.getIsSelected();
      return (
        <div className="px-1">
          <Input
            type="checkbox"
            checked={checked}
            disabled={!row.getCanSelect()}
            // indeterminate={row.getIsSomeSelected()}
            onChange={onChange}
          />
        </div>
      );
    },
  };
  const numberColumn = {
    id: "number",
    header: () => "#",
    cell: ({ row }) => row.original.index,
  };

  const columns = schemaColumns.map((column) => {
    const columnName = column.column_name;

    return {
      accessorKey: columnName,
      header: () => <span>{columnName}</span>,
      cell: (info) => {
        const value = info.getValue();
        // const rowData = info.row.original;
        return <DatabaseTableCell column={column} value={value} />;
      },
      footer: (info) => info.column.id,
    };
  });

  const data = rows;

  return (
    <div>
      <Table
        columns={[selectColumn, numberColumn, ...columns]}
        data={data}
        rowSelection={rowSelection}
        onRowSelectionChange={(value) => {
          setRowSelection(value);
        }}
        style={{ height: "fit-content" }}
      />
      {data.length === 0 ? <div>No data</div> : null}
      <div className="table_data_actions">
        <Button action={createRow}>Add row</Button>
      </div>
    </div>
  );
};

const DatabaseTableCell = ({ column, value }) => {
  const { editable, startEditing, stopEditing } = useEditableController();
  const databaseInputProps = useDatabaseInputProps({ column });

  return (
    <Editable editable={editable} inputProps={databaseInputProps}></Editable>
  );
};
