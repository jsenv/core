/**
 *
 * https://tanstack.com/table/v8/docs/framework/react/examples/basic
 * https://docs.google.com/spreadsheets/d/1m1wWDgM61HUbkShYYR9ClAFhLPE7edh-tzeF6hA2dww/edit?gid=0#gid=0
 */

import { getCoreRowModel } from "@tanstack/table-core";
import { forwardRef } from "preact/compat";
import { useMemo } from "preact/hooks";
import "./table.css" with { type: "css" };
import { useTable } from "./use_table.js";

export const Table = forwardRef((props, ref) => {
  const { columns, data, ...rest } = props;

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
    state: {},
    defaultColumn: {
      size: 200, //starting column size
      minSize: 50, //enforced during column resizing
      maxSize: 500, //enforced during column resizing
    },
  });

  return (
    <table ref={ref} {...rest}>
      <thead>
        {getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              const HeaderCellComponent = header.column.columnDef.header;
              const headerCellProps = header.getContext();
              if (header.isPlaceholder) {
                return <th key={header.id}></th>;
              }
              return (
                <HeaderCellComponent key={header.id} {...headerCellProps} />
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
});

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
      header: () => (
        <th>
          <span>{extraColumnKey}</span>
        </th>
      ),
      cell: (info) => <td>{info.getValue()}</td>,
      footer: (info) => <td>{info.column.id}</td>,
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
  const BodyCellComponent = cell.column.columnDef.cell;
  const bodyCellProps = cell.getContext();
  return <BodyCellComponent {...bodyCellProps} />;
};
