import { Table } from "./table.jsx";
import { SPAForm, useRouteUrl } from "@jsenv/router";

export const DatabaseTable = ({ columns, data, putRoute }) => {
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
          <CellDefaultComponent
            tableName={tableName}
            column={column}
            putRoute={putRoute}
          >
            {value}
          </CellDefaultComponent>
        );
      },
      footer: (info) => info.column.id,
    };
  });

  return <Table columns={tableColumns} data={data} />;
};

const TableNameCell = ({ name }) => {
  return (
    <div>
      <span>{name}</span>
    </div>
  );
};

const BooleanCell = ({
  putRoute,
  tableName,
  columnName,
  isUpdatable,
  checked,
}) => {
  const putTablePropUrl = useRouteUrl(putRoute, {
    name: tableName,
    prop: columnName,
  });
  return (
    <SPAForm action={putTablePropUrl} method="PUT">
      <input
        type="checkbox"
        disabled={!isUpdatable}
        name="value"
        checked={checked}
        onChange={(e) => {
          const form = e.target.form;
          form.requestSubmit();
        }}
      />
    </SPAForm>
  );
};

const CellDefaultComponent = ({ tableName, column, putRoute, children }) => {
  if (column.name === "tablename") {
    return <TableNameCell name={children} />;
  }
  if (column.data_type === "boolean") {
    return (
      <BooleanCell
        tableName={tableName}
        columnName={column.column_name}
        putRoute={putRoute}
        isUpdatable={
          column.is_updatable === "YES" || column.column_name === "rowsecurity"
        }
        checked={children}
      />
    );
  }
  return String(children);
};
