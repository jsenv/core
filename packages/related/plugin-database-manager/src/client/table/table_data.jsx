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
  Checkbox,
  Col,
  Colgroup,
  countSelectedRows,
  Label,
  RowNumberCol,
  RowNumberTableCell,
  stringifyTableSelectionValue,
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

  const selectedRowCount = countSelectedRows(selection);

  return (
    <div>
      {rows.length === 0 ? (
        <div>No data</div>
      ) : (
        <>
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
                <Col key={column.column_name} id={column.column_name} />
              ))}
            </Colgroup>
            <Thead>
              <Tr id="head">
                <RowNumberTableCell />
                {columns.map((column) => (
                  <TableCell
                    key={column.column_name}
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
                      const columnId = columns[columnIndex].column_name;
                      return (
                        <TableCell
                          key={columnId}
                          action={async (v) => {
                            await TABLE_ROW.PATCH({
                              tablename: tableName,
                              rowId: object.id,
                              properties: {
                                [columnId]: v,
                              },
                            });
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
          <div>
            <Label>
              <Checkbox
                action={() => {
                  if (selectedRowCount === 0) {
                    const rowSelection = [];
                    let rowCount = rows.length;
                    let y = 0;
                    while (y < rowCount) {
                      const firstCellValue = stringifyTableSelectionValue(
                        "row",
                        y,
                      );
                      rowSelection.push(firstCellValue);
                      y++;
                    }

                    setSelection(rowSelection);
                  } else {
                    setSelection([]);
                  }
                }}
              />
              {selectedRowCount === 0
                ? "Select all"
                : `${selectedRowCount} selected`}
            </Label>
            <Button action={() => {}}>Delete</Button>
          </div>
        </>
      )}
      <div className="table_data_actions">
        <Button action={createRow}>Add row</Button>
      </div>
    </div>
  );
};
