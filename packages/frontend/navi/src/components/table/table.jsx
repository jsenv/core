import { useSignal } from "@preact/signals";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import {
  useSelectableElement,
  useSelectionProvider,
} from "../selection/selection.jsx";
import { useFocusGroup } from "../use_focus_group.js";
import { TableSelectionBorders } from "./table_selection_borders.jsx";

const RowNumberHeaderCell = () => {
  return (
    <th className="number-column" style={{ textAlign: "center" }}>
      #
    </th>
  );
};

const RowNumberCell = ({ row, columns, rowWithSomeSelectedCell }) => {
  const cellRef = useRef();
  const rowValue = `row:${row.id}`;
  const { selected } = useSelectableElement(cellRef, {
    selectionImpact: () => {
      // Return all data cells in this row that should be impacted
      return columns.map((col) => `${col.accessorKey}:${row.id}`);
    },
  });

  const rowContainsSelectedCell = rowWithSomeSelectedCell.includes(row.id);

  return (
    <td
      ref={cellRef}
      className="database_table_cell number-column"
      data-row-contains-selected={rowContainsSelectedCell ? "" : undefined}
      data-value={rowValue}
      data-selection-name="row"
      data-selection-toggle-shortcut="space"
      aria-selected={selected}
      style={{ cursor: "pointer", textAlign: "center" }}
      tabIndex={-1}
    >
      {row.index}
    </td>
  );
};

const HeaderCell = ({
  columnName,
  columnAccessorKey,
  columnWithSomeSelectedCell,
}) => {
  const cellRef = useRef();
  const columnValue = `column:${columnAccessorKey}`;
  const { selected } = useSelectableElement(cellRef);

  const columnContainsSelectedCell =
    columnWithSomeSelectedCell.includes(columnAccessorKey);
  return (
    <th
      ref={cellRef}
      className="database_table_cell"
      data-column-contains-selected={
        columnContainsSelectedCell ? "" : undefined
      }
      data-value={columnValue}
      data-selection-name="column"
      data-selection-toggle-shortcut="space"
      aria-selected={selected}
      style={{ cursor: "pointer" }}
      tabIndex={-1}
    >
      <span>{columnName}</span>
    </th>
  );
};

const DataCell = ({ columnName, row, value }) => {
  const cellId = `${columnName}:${row.id}`;
  const cellRef = useRef();
  const { selected } = useSelectableElement(cellRef);

  return (
    <td
      ref={cellRef}
      className="database_table_cell"
      tabIndex={-1}
      data-value={cellId}
      data-selection-name="cell"
      aria-selected={selected}
    >
      {value}
    </td>
  );
};

export const Table = forwardRef((props, ref) => {
  let { columns, data, selection = [], onSelectionChange } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => {
    return {
      element: innerRef.current,
      clearSelection: () => {
        selectionSignal.value = [];
      },
      selectAll: () => {
        // Select all data cells (not row/column selectors)
        const allCellIds = [];
        data.forEach((row) => {
          columns.forEach((col) => {
            allCellIds.push(`${col.accessorKey}:${row.id}`);
          });
        });
        selectionSignal.value = allCellIds;
      },
    };
  });

  const selectionSignal = useSignal(selection);
  selection = selectionSignal.value;
  // After expansion, everything is cell selections
  const cellSelections = selection.filter(
    (value) =>
      typeof value === "string" &&
      value.includes(":") &&
      !value.startsWith("row:") &&
      !value.startsWith("column:"),
  );

  // Analyze selected cells to determine if they represent full row/column selections
  const rowWithSomeSelectedCell = [];
  const columnWithSomeSelectedCell = [];
  const selectedRowIds = [];
  const selectedColumnIds = [];
  // Group selected cells by row and column
  const cellsByRow = new Map();
  const cellsByColumn = new Map();
  for (const cellId of cellSelections) {
    const [columnName, rowId] = cellId.split(":");

    // Track cells by row
    if (!cellsByRow.has(rowId)) {
      cellsByRow.set(rowId, []);
    }
    cellsByRow.get(rowId).push(columnName);

    // Track cells by column
    if (!cellsByColumn.has(columnName)) {
      cellsByColumn.set(columnName, []);
    }
    cellsByColumn.get(columnName).push(rowId);

    // Add to some-selected tracking
    if (!rowWithSomeSelectedCell.includes(rowId)) {
      rowWithSomeSelectedCell.push(rowId);
    }
    if (!columnWithSomeSelectedCell.includes(columnName)) {
      columnWithSomeSelectedCell.push(columnName);
    }
  }
  // Check for complete row selections (all columns in a row selected)
  for (const [rowId, selectedColumns] of cellsByRow) {
    if (selectedColumns.length === columns.length) {
      selectedRowIds.push(rowId);
    }
  }
  // Check for complete column selections (all rows in a column selected)
  for (const [columnName, selectedRows] of cellsByColumn) {
    if (selectedRows.length === data.length) {
      selectedColumnIds.push(columnName);
    }
  }

  const SelectionProvider = useSelectionProvider({
    elementRef: innerRef,
    layout: "grid",
    value: selection,
    onChange: (value) => {
      selectionSignal.value = value;
      onSelectionChange(value);
    },
  });
  useFocusGroup(innerRef);

  return (
    <div className="table-container">
      <SelectionProvider>
        <table
          ref={innerRef}
          className="database_table"
          aria-multiselectable="true"
          data-multiselection={selection.length > 1 ? "" : undefined}
        >
          <thead>
            <tr>
              <RowNumberHeaderCell />
              {columns.map((col, index) => (
                <HeaderCell
                  key={col.id}
                  columnName={col.header}
                  columnAccessorKey={col.accessorKey}
                  columnIndex={index + 1}
                  columnWithSomeSelectedCell={columnWithSomeSelectedCell}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const isRowSelected = selectedRowIds.includes(row.id);
              return (
                <tr
                  key={row.id}
                  data-row-id={row.id}
                  aria-selected={isRowSelected}
                >
                  <RowNumberCell
                    row={row}
                    rowWithSomeSelectedCell={rowWithSomeSelectedCell}
                    columns={columns}
                  />
                  {columns.map((col, colIndex) => (
                    <DataCell
                      key={`${row.id}-${col.id}`}
                      columnName={col.accessorKey}
                      columnIndex={colIndex + 1} // +1 because number column is first
                      row={row}
                      value={row[col.accessorKey]}
                    />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </SelectionProvider>
      <TableSelectionBorders tableRef={innerRef} />
    </div>
  );
});
