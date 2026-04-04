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
  Box,
  Button,
  Checkbox,
  Col,
  Colgroup,
  filterTableSelection,
  Label,
  RowNumberCol,
  RowNumberTableCell,
  SidePanel,
  stringifyTableSelectionValue,
  Table,
  TableCell,
  Tbody,
  Text,
  Thead,
  Tr,
  useCellGridFromRows,
  useOrderedColumns,
} from "@jsenv/navi";
import { useRef, useState } from "preact/hooks";

import { ColumnSidePanelContent } from "./column_side_panel_content.jsx";
import { TABLE_COLUMN, TABLE_ROW } from "./table_store.js";

import.meta.css = /* css */ `
  .table_data_actions {
    margin-bottom: 15px;
  }
`;

export const TableData = ({ table, rows }) => {
  const tableRef = useRef(null);
  const { tablename, columns } = table;
  const createRow = TABLE_ROW.POST.bindParams({ tablename });

  const [orderedColumns] = useOrderedColumns(columns, undefined, {
    columnIdKey: "column_name",
  });
  const orderedColumnIds = orderedColumns.map((c) => c.column_name);
  const cellGrid = useCellGridFromRows(rows, orderedColumnIds);
  const [selection, setSelection] = useState([]);

  const selectedRowIds = filterTableSelection(
    selection,
    ({ columnId }) => columnId === "row_number",
  ).map(({ rowId }) => rowId);
  // selectedRowIds is an array of rowId as string (selection values are strings to be primitive AND hold both columnId and rowId infos)
  const selectedRows = rows.filter((r) => {
    return selectedRowIds.includes(String(r.id));
  });
  const selectedRowCount = selectedRows.length;

  const [selectedColumn, setSelectedColumn] = useState(null);

  return (
    <div>
      <Box>
        <Box column spacing="m">
          <Table
            ref={tableRef}
            className="database_table"
            selection={selection}
            onSelectionChange={setSelection}
            borderCollapse
          >
            <Colgroup>
              <RowNumberCol />
              {orderedColumns.map((column) => (
                <Col key={column.column_name} id={column.column_name} />
              ))}
            </Colgroup>
            <Thead>
              <Tr id="head">
                <RowNumberTableCell />
                {orderedColumns.map((column) => (
                  <TableCell
                    key={column.column_name}
                    action={async (value) => {
                      await TABLE_COLUMN.PUT({
                        tablename,
                        columnName: column.column_name,
                        propertyName: "column_name",
                        propertyValue: value,
                      });
                    }}
                    onClick={() => {
                      setSelectedColumn(column);
                    }}
                  >
                    {column.column_name}
                  </TableCell>
                ))}
              </Tr>
            </Thead>
            <Tbody>
              {cellGrid.map((rowCells, rowIndex) => {
                const object = rows[rowIndex];

                return (
                  <Tr key={object.id} id={object.id}>
                    <RowNumberTableCell />
                    {rowCells.map((cellValue, columnIndex) => {
                      const columnId = orderedColumns[columnIndex].column_name;
                      return (
                        <TableCell
                          key={columnId}
                          action={async (v) => {
                            await TABLE_ROW.PATCH({
                              tablename,
                              rowId: object.id,
                              properties: {
                                [columnId]: v,
                              },
                            });
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
          <Box>
            <Button
              action={async () => {
                await TABLE_COLUMN.POST({ tablename });
              }}
            >
              +
            </Button>
          </Box>
        </Box>
        <Box column spacing="s" alignY="center" paddingY="s">
          <Label column alignY="center" spacing="xs">
            <Checkbox
              checked={selectedRowCount > 0}
              action={() => {
                if (selectedRowCount === 0) {
                  const rowSelection = [];
                  let rowCount = rows.length;
                  let y = 0;
                  while (y < rowCount) {
                    const firstCellValue = stringifyTableSelectionValue(
                      "cell",
                      { columnId: "row_number", rowId: rows[y].id },
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
            <Text size="xs" bold>
              {selectedRowCount === 0
                ? "Select all"
                : `${selectedRowCount} selected`}
            </Text>
          </Label>
          <SelectedRowActions
            tablename={tablename}
            selectedRows={selectedRows}
          />
        </Box>
      </Box>
      <div className="table_data_actions">
        <Button action={createRow}>Add row</Button>
      </div>

      <SidePanel
        isOpen={Boolean(selectedColumn)}
        onClose={() => {
          setSelectedColumn(null);
        }}
      >
        {selectedColumn ? (
          <ColumnSidePanelContent
            tablename={tablename}
            column={selectedColumn}
            // onClose={() => setSelectedColumn(null)}
          />
        ) : null}
      </SidePanel>
    </div>
  );
};

const SelectedRowActions = ({ tablename, selectedRows }) => {
  const selectedRowCount = selectedRows.length;
  if (selectedRowCount === 0) {
    return null;
  }

  let message;
  if (selectedRowCount === 1) {
    const rowSelected = selectedRows[0];
    let rowName;
    if (rowSelected.name) {
      rowName = `row named "${rowSelected.name}"`;
    } else {
      rowName = `row #${rowSelected.id}`;
    }
    message = `Are you sur you want to delete ${rowName}?`;

    return (
      <Button
        data-confirm-message={message}
        action={async () => {
          await TABLE_ROW.DELETE({ tablename, rowId: rowSelected.id });
        }}
      >
        Delete
      </Button>
    );
  }

  return (
    <Button
      data-confirm-message={`Are you sure you want to delete the ${selectedRowCount} selected rows?`}
      action={async () => {
        await TABLE_ROW.DELETE_MANY({
          tablename,
          rowIds: selectedRows.map((r) => r.id),
        });
      }}
    >
      Delete
    </Button>
  );
};
