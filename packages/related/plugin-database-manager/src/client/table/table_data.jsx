import { DatabaseField } from "../components/database_field.jsx";
import { Table } from "../components/table.jsx";

export const TableData = ({ table, rows }) => {
  const { schemaColumns } = table.meta;
  const columns = schemaColumns.map((column) => {
    const columnName = column.column_name;

    return {
      accessorKey: columnName,
      header: () => <span>{columnName}</span>,
      cell: (info) => {
        const value = info.getValue();
        const tableName = info.row.original.tablename;
        return (
          <DatabaseField
            tableName={tableName}
            column={column}
            action={null}
            value={value}
          />
        );
      },
      footer: (info) => info.column.id,
    };
  });

  return (
    <Table columns={columns} data={rows} style={{ height: "fit-content" }} />
  );
};
