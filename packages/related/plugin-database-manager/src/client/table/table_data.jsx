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

import {
  Button,
  Col,
  Colgroup,
  RowNumberCol,
  RowNumberTableCell,
  Table,
  TableCell,
  Tbody,
  Thead,
  Tr,
  useCellsAndColumns,
  useGrid,
} from "@jsenv/navi";
import { useRef, useState } from "preact/hooks";

import { TABLE_ROW } from "./table_store.js";

import.meta.css = /* css */ `
  .table_data_actions {
    margin-bottom: 15px;
  }
`;

export const TableData = ({ table, rows }) => {
  const tableRef = useRef(null);
  const tableName = table.tablename;
  const createRow = TABLE_ROW.POST.bindParams({ tablename: tableName });
  const { schemaColumns } = table.meta;
  schemaColumns.sort((a, b) => a.ordinal_position - b.ordinal_position);

  const grid = useGrid(
    rows,
    schemaColumns.map((c) => c.column_name),
  );
  const [selection, setSelection] = useState([]);
  const { cells, setCellValue, columns } = useCellsAndColumns(
    grid,
    schemaColumns,
    { columnIdKey: "column_name" },
  );

  return (
    <div>
      <Table
        ref={tableRef}
        className="database_table"
        selection={selection}
        onSelectionChange={setSelection}
        borderCollapse
      >
        <Colgroup>
          <RowNumberCol />
          {columns.map((column) => (
            <Col key={column.id} id={column.id} />
          ))}
        </Colgroup>
        <Thead>
          <Tr id="head">
            <RowNumberTableCell />
            {columns.map((column) => (
              <TableCell
                key={column.id}
                action={(value) => {
                  console.log("column action", value);
                }}
              >
                {column.column_name}
              </TableCell>
            ))}
          </Tr>
        </Thead>
        <Tbody>
          {cells.map((rowCells, rowIndex) => {
            const object = rows[rowIndex];

            return (
              <Tr key={object.id} id={object.id}>
                <RowNumberTableCell />
                {rowCells.map((cellValue, columnIndex) => {
                  const columnId = columns[columnIndex].id;
                  return (
                    <TableCell
                      key={columnId}
                      action={(v) => {
                        setCellValue({ rowIndex, columnIndex }, v);
                      }}
                    >
                      {cellValue}
                    </TableCell>
                  );
                })}
              </Tr>
            );
          })}
        </Tbody>
      </Table>
      {rows.length === 0 ? <div>No data</div> : null}
      <div className="table_data_actions">
        <Button action={createRow}>Add row</Button>
      </div>
    </div>
  );
};
