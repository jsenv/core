/**
 * https://tanstack.com/table/latest/docs/framework/react/examples/basic?panel=code
 *
 */

import {
  Button,
  Editable,
  useEditableController,
  useStateArray,
} from "@jsenv/navi";
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

  .database_table_cell_content:focus {
    outline: 2px solid #0078d4;
    outline-offset: -2px;
  }

  .database_table_cell_content[data-editing] {
    outline: 2px solid #a8c7fa;
    outline-offset: 0px;
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
  const [rowSelection, addRowToSelection, removeRowFromSelection] =
    useStateArray();
  const rowIsSelected = (row) => rowSelection.includes(row.id);

  const { schemaColumns } = table.meta;
  const numberColumn = {
    id: "number",
    size: 50,
    header: () => "",
    enableResizing: false,
    cell: ({ row }) => {
      return (
        <div
          style={{
            textAlign: "center",
          }}
        >
          {row.original.index}
        </div>
      );
    },
  };

  const columns = schemaColumns.map((column) => {
    const columnName = column.column_name;

    return {
      enableResizing: true,
      accessorKey: columnName,
      header: () => <span>{columnName}</span>,
      cell: (info) => {
        const value = info.getValue();
        const row = info.row;
        const selected = rowIsSelected(row);
        // const rowData = info.row.original;
        return (
          <DatabaseTableCell
            onClick={() => {
              if (selected) {
                removeRowFromSelection(row.id);
              } else {
                addRowToSelection(row.id);
              }
            }}
            column={column}
            value={value}
          />
        );
      },
      footer: (info) => info.column.id,
    };
  });

  const data = rows;

  return (
    <div>
      <Table
        className="database_table"
        columns={[numberColumn, ...columns]}
        data={data}
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
    <div
      className="database_table_cell_content"
      tabIndex="0"
      data-editing={editable ? "" : undefined}
    >
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
