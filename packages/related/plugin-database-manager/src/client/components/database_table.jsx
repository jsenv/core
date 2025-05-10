import { Table } from "./table.jsx";
import { DatabaseValue } from "./database_value.jsx";
import { useAction } from "@jsenv/router";

export const DatabaseTable = ({ columns, action, data }) => {
  columns.sort((a, b) => {
    return a.ordinal_position - b.ordinal_position;
  });
  const tableColumns = columns.map((column) => {
    const columnName = column.column_name;

    return {
      accessorKey: columnName,
      header: () => <span>{columnName}</span>,
      cell: (info) => {
        const value = info.getValue();
        const tableName = info.row.original.tablename;
        return (
          <DatabaseValue
            tableName={tableName}
            column={column}
            action={useAction(action, { tableName, columnName })}
            value={value}
          />
        );
      },
      footer: (info) => info.column.id,
    };
  });

  return <Table columns={tableColumns} data={data} />;
};
