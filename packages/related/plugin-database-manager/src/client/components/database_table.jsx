import { DatabaseField } from "./database_field.jsx";
import { Table } from "./table.jsx";

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
          <DatabaseField
            tableName={tableName}
            column={column}
            action={action.bindParams({ tableName, columnName })}
            value={value}
          />
        );
      },
      footer: (info) => info.column.id,
    };
  });

  return <Table columns={tableColumns} data={data} />;
};
