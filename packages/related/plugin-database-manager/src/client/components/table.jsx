/**
 *
 *  https://tanstack.com/table/v8/docs/framework/react/examples/basic
 */

import { getCoreRowModel } from "@tanstack/table-core";
import { useMemo } from "preact/hooks";
import "./table.css" with { type: "css" };
import { useTable } from "./use_table.js";

export const Table = ({
  columns,
  data,
  rowSelection,
  onRowSelectionChange,
  ...props
}) => {
  const extraColumns = useMemo(
    () => getExtraColumns(columns, data),
    [columns, data],
  );
  const {
    getHeaderGroups,
    getRowModel,
    // getFooterGroups
  } = useTable({
    columns: extraColumns ? [...columns, ...extraColumns] : columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
    state: {
      rowSelection,
    },
    defaultColumn: {
      size: 200, //starting column size
      minSize: 50, //enforced during column resizing
      maxSize: 500, //enforced during column resizing
    },
    onRowSelectionChange,
  });

  return (
    <table {...props}>
      <thead>
        {getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              return (
                <th
                  key={header.id}
                  style={{
                    ...(header.column.columnDef.enableResizing !== false
                      ? { width: `${header.getSize()}px` }
                      : {}),
                  }}
                >
                  {header.isPlaceholder ? null : (
                    <header.column.columnDef.header {...header.getContext()} />
                  )}
                </th>
              );
            })}
          </tr>
        ))}
      </thead>
      <TableBody rows={getRowModel().rows} />
      {/* <tfoot>
        {getFooterGroups().map((footerGroup) => (
          <tr key={footerGroup.id}>
            {footerGroup.headers.map((header) => (
              <th key={header.id}>
                {header.isPlaceholder ? null : (
                  <header.column.columnDef.footer {...header.getContext()} />
                )}
              </th>
            ))}
          </tr>
        ))}
      </tfoot> */}
    </table>
  );
};

const getExtraColumns = (columns, values) => {
  const columnSet = new Set();
  for (const { accessor } of columns) {
    if (typeof accessor !== "string") {
      // when an accessor is not a string we can't detect extra columns
      // because accessor might be refering to a nested property or a propery we might
      // detect as extra but is not
      return null;
    }
    columnSet.add(accessor);
  }
  const extraColumnSet = new Set();
  for (const value of values) {
    if (value && typeof value === "object") {
      for (const key in Object.keys(value)) {
        if (columnSet.has(key)) {
          continue;
        }
        if (extraColumnSet.has(key)) {
          continue;
        }
        extraColumnSet.add(key);
      }
    }
  }
  if (extraColumnSet.size === 0) {
    return null;
  }
  const extraColumns = [];
  for (const extraColumnKey of extraColumnSet) {
    const extraColumn = {
      accessor: extraColumnKey,
      id: extraColumnKey,
      cell: (info) => info.getValue(),
      header: () => <span>{extraColumnKey}</span>,
      footer: (info) => info.column.id,
    };
    extraColumns.push(extraColumn);
  }
  return extraColumns;
};

const TableBody = ({ rows }) => {
  return (
    <tbody>
      {rows.map((row) => (
        <TableBodyRow key={row.id} cells={row.getVisibleCells()} />
      ))}
    </tbody>
  );
};
const TableBodyRow = ({ cells }) => {
  return (
    <tr>
      {cells.map((cell) => (
        <TableBodyCell key={cell.id} cell={cell} />
      ))}
    </tr>
  );
};
const TableBodyCell = ({ cell }) => {
  const CellComponent = cell.column.columnDef.cell;
  const cellProps = cell.getContext();
  return (
    <td>
      <CellComponent {...cellProps} />
    </td>
  );
};
