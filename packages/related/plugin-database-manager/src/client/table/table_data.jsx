/**
 * https://tanstack.com/table/latest/docs/framework/react/examples/basic?panel=code
 *
 * https://supabase.com/docs/guides/database/overview
 *
 *
 * Next step:
 * 3. A last row with buttons like a delete button with a delete icon
 * 4. Ability to delete a row (button + a shortcut key cmd + delete) with a confirmation message
 * 5. Ability to update a cell (double click to edit, enter to validate, esc to cancel)
 * 6. Pagination
 * 7. Can add a column
 * 8. Can remove a column
 * 9. Can edit a column (name, type, etc.)
 *
 */

import { Button, Table } from "@jsenv/navi";
import { useMemo, useRef, useState } from "preact/hooks";
import { TABLE_ROW } from "./table_store.js";

import.meta.css = /* css */ `
  .table_data_actions {
    margin-bottom: 15px;
  }

  .database_table_cell {
    padding: 0;
  }

  .database_table[data-multi-selection] .database_table_cell[data-selected] {
    background-color: light-dark(
      rgba(0, 120, 212, 0.08),
      rgba(59, 130, 246, 0.15)
    );
  }

  .database_table_cell:focus {
    /* Table cell border size impacts the visual appeareance of the outline */
    /* (It's kinda melted into the table border, as if it was 1.5 px instead of 2) */
    /* To avoid this we display outline on .database_table_cell_content  */
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

  .database_table *[data-focus-within] {
    background-color: light-dark(
      rgba(0, 120, 212, 0.08),
      rgba(59, 130, 246, 0.15)
    );
  }
`;

export const TableData = ({ table, rows }) => {
  const tableRef = useRef(null);
  const tableName = table.tablename;
  const createRow = TABLE_ROW.POST.bindParams({ tablename: tableName });

  const { schemaColumns } = table.meta;

  // Stable column definitions - only recreate when schema changes
  const columns = useMemo(() => {
    return schemaColumns.map((column, index) => {
      const columnName = column.column_name;
      const columnIndex = index + 1; // +1 because number column is first

      return {
        enableResizing: true,
        accessorKey: columnName,
        header: ({ header }) => (
          <DatabaseTableHeaderCell
            header={header}
            columnName={columnName}
            columnIndex={columnIndex}
          />
        ),
        cell: (info) => (
          <DatabaseTableCell
            columnName={columnName}
            column={column}
            value={info.getValue()}
            row={info.row}
          />
        ),
        footer: (info) => info.column.id,
      };
    });
  }, [schemaColumns]); // Only depend on schema, not dynamic state

  const data = rows;

  const [selection, setSelection] = useState([]);

  return (
    <div>
      <Table
        ref={tableRef}
        className="database_table"
        selection={selection}
        onSelectionChange={setSelection}
        idKey="id"
        columns={columns}
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
