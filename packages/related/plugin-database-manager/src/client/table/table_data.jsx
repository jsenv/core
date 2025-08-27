/**
 * https://tanstack.com/table/latest/docs/framework/react/examples/basic?panel=code
 *
 * Next step:
 * 1. When a cell is focuses the corresponding th should have a background and the first column too (the one with row number)
 * 2. row selection (take inspitation from the way it's done in the explorer)
 *    selected row should have a special background
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
  Editable,
  useEditableController,
  useFocusGroup,
  useStateArray,
} from "@jsenv/navi";
import { createContext } from "preact";
import {
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";
import { useDatabaseInputProps } from "../components/database_field.jsx";
import { Table } from "../components/table.jsx";
import { TABLE_ROW } from "./table_store.js";

// Context to pass dynamic state to stable components
const TableStateContext = createContext();

import.meta.css = /* css */ `
  .table_data_actions {
    margin-bottom: 15px;
  }

  .database_table_cell {
    padding: 0;
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
  const tableName = table.tablename;
  const createRow = TABLE_ROW.POST.bindParams({ tablename: tableName });
  const [rowSelection, addRowToSelection, removeRowFromSelection] =
    useStateArray();
  const rowIsSelected = useCallback(
    (row) => rowSelection.includes(row.id),
    [rowSelection],
  );

  const tableRef = useRef(null);

  useFocusGroup(tableRef);
  const [focusWithinRow, setFocusWithinRow] = useState(-1);
  const [focusWithinColumn, setFocusWithinColumn] = useState(-1);

  const updateFocusPosition = (elementFocusedOrReceivingFocus) => {
    const [column, row] = getCellPosition(
      tableRef.current,
      elementFocusedOrReceivingFocus,
    );
    setFocusWithinColumn(column);
    setFocusWithinRow(row);
  };
  const handleTableFocusIn = (event) => {
    updateFocusPosition(event.target);
  };
  const handleTableFocusOut = (event) => {
    const table = tableRef.current;
    if (!table) {
      return;
    }
    updateFocusPosition(event.relatedTarget);
  };

  const { schemaColumns } = table.meta;

  // Stable column definitions - only recreate when schema changes
  const columns = useMemo(() => {
    const numberColumn = {
      id: "number",
      header: NumberColumnHeader,
      enableResizing: false,
      cell: NumberColumnCell,
    };

    const remainingColumns = schemaColumns.map((column, index) => {
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
            column={column}
            value={info.getValue()}
            row={info.row}
            selected={rowIsSelected(info.row)}
          />
        ),
        footer: (info) => info.column.id,
        // Store static data for use in components
        meta: {
          columnName,
          columnIndex,
          column,
        },
      };
    });

    return [numberColumn, ...remainingColumns];
  }, [schemaColumns]); // Only depend on schema, not dynamic state

  const data = rows;

  // Create a stable context value for the table
  const tableState = useMemo(
    () => ({
      focusWithinRow,
      focusWithinColumn,
      rowSelection,
      rowIsSelected,
      addRowToSelection,
      removeRowFromSelection,
    }),
    [
      focusWithinRow,
      focusWithinColumn,
      rowSelection,
      rowIsSelected,
      addRowToSelection,
      removeRowFromSelection,
    ],
  );

  return (
    <TableStateContext.Provider value={tableState}>
      <div>
        <Table
          ref={tableRef}
          className="database_table"
          columns={columns}
          data={data}
          style={{ height: "fit-content" }}
          onFocusIn={(event) => {
            handleTableFocusIn(event);
          }}
          onFocusOut={(event) => {
            handleTableFocusOut(event);
          }}
        />
        {data.length === 0 ? <div>No data</div> : null}
        <div className="table_data_actions">
          <Button action={createRow}>Add row</Button>
        </div>
      </div>
    </TableStateContext.Provider>
  );
};

const getCellPosition = (table, element) => {
  if (!table.contains(element)) {
    return [-1, -1];
  }
  const cellElement = element.closest("td");
  if (!cellElement) {
    return [-1, -1];
  }
  const row = cellElement.parentElement;
  const columnIndex = Array.from(row.cells).indexOf(cellElement);
  const rowIndex = Array.from(table.rows).indexOf(row);
  return [columnIndex, rowIndex];
};

// Stable component definitions - these don't recreate on every render
const NumberColumnHeader = () => {
  return <th style={{ width: "50px" }}></th>;
};

const NumberColumnCell = ({ row }) => {
  const { focusWithinRow } = useContext(TableStateContext);
  return (
    <DatabaseTableClientCell
      style={{ textAlign: "center" }}
      data-focus-within={focusWithinRow === row.index + 1 ? "" : undefined}
    >
      {row.original.index}
    </DatabaseTableClientCell>
  );
};

const DatabaseTableHeaderCell = ({ header, columnName, columnIndex }) => {
  const { focusWithinColumn } = useContext(TableStateContext);

  return (
    <th
      style={{
        width: `${header.getSize()}px`,
      }}
      data-focus-within={focusWithinColumn === columnIndex ? "" : undefined}
    >
      <span>{columnName}</span>
    </th>
  );
};

const DatabaseTableClientCell = ({ children, ...props }) => {
  return (
    <td className="database_table_cell" {...props}>
      {children}
    </td>
  );
};

const DatabaseTableCell = ({ column, row, value, selected, ...props }) => {
  const { addRowToSelection, removeRowFromSelection } =
    useContext(TableStateContext);
  const { editable, startEditing, stopEditing } = useEditableController();
  const databaseInputProps = useDatabaseInputProps({ column });

  return (
    <td
      className="database_table_cell"
      tabIndex="0"
      data-editing={editable ? "" : undefined}
      onClick={() => {
        if (selected) {
          removeRowFromSelection(row.id);
        } else {
          addRowToSelection(row.id);
        }
      }}
      {...props}
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
