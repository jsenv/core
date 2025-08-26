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

  .database_table td {
    padding: 0;
  }

  .database_table_cell_content {
    display: inline-flex;
    flex-grow: 1;
    width: 100%;
    height: 100%;
  }

  .database_table_cell_value {
    display: inline-flex;
    flex-grow: 1;
    user-select: none;
    padding: 8px;
  }

  .database_table_cell_content input {
    width: 100%;
    height: 100%;
    display: inline-flex;
    flex-grow: 1;
    padding-left: 8px;
  }

  .database_table_cell_content input[type="number"]::-webkit-inner-spin-button {
    width: 14px;
    height: 30px;
  }
`;

export const TableData = ({ table, rows }) => {
  const tableName = table.tablename;
  const createRow = TABLE_ROW.POST.bindParams({ tablename: tableName });
  const [rowSelection, setRowSelection] = useState({});

  const { schemaColumns } = table.meta;
  const selectColumn = {
    id: "select",
    enableResizing: false,
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
    enableResizing: false,
    cell: ({ row }) => row.original.index,
  };

  const columns = schemaColumns.map((column) => {
    const columnName = column.column_name;

    return {
      enableResizing: true,
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
        className="database_table"
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
    <div className="database_table_cell_content" tabIndex="0">
      <Editable
        editable={editable}
        onEditEnd={stopEditing}
        value={value}
        {...databaseInputProps}
      >
        <div
          className="database_table_cell_value"
          onDoubleClick={() => {
            startEditing();
          }}
        >
          {value}
        </div>
      </Editable>
    </div>
  );
};
