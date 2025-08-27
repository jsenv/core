/**
 * https://tanstack.com/table/latest/docs/framework/react/examples/basic?panel=code
 *
 */

import {
  Button,
  Editable,
  useEditableController,
  useFocusGroup,
  useStateArray,
} from "@jsenv/navi";
import { useRef } from "preact/hooks";
import { useDatabaseInputProps } from "../components/database_field.jsx";
import { Table } from "../components/table.jsx";
import { TABLE_ROW } from "./table_store.js";

import.meta.css = /* css */ `
  .table_data_actions {
    margin-bottom: 15px;
  }

  .database_table_cell {
    padding: 0;
  }

  .database_table_cell:focus {
    /* Table cell border size impacts the visual appeareance of the outline
                (It's kinda melted into the table border, as if it was 1.5 px instead of 2)
                -> To avoid this we display outline on .database_table_cell_content */
    outline: none;
  }

  .database_table_cell:focus .database_table_cell_content {
    outline: 2px solid #0078d4;
    outline-color: light-dark(#355fcc, #3b82f6);
    outline-offset: -2px;
  }

  .database_table_cell[data-editing] .database_table_cell_content {
    outline: 2px solid #a8c7fa;
    outline-offset: 0px;
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
    border-radius: 0; /* match table cell border-radius */
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
  const tableRef = useRef(null);

  useFocusGroup(tableRef);

  const { schemaColumns } = table.meta;
  const numberColumn = {
    id: "number",
    size: 50,
    header: () => "",
    enableResizing: false,
    cell: ({ row }) => {
      return (
        <td
          style={{
            textAlign: "center",
          }}
        >
          {row.original.index}
        </td>
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
        ref={tableRef}
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
    <td
      className="database_table_cell"
      tabIndex="0"
      data-editing={editable ? "" : undefined}
    >
      <div className="database_table_cell_content">
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
    </td>
  );
};
