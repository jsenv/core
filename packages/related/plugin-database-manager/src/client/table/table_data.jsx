import { DatabaseField } from "../components/database_field.jsx";
import { Table } from "../components/table.jsx";

export const TableData = ({ table, rows }) => {
  const { columns } = table.meta;
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

  return <Table columns={tableColumns} data={rows} />;
};
