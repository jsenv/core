import { useRouteUrl, SPACheckbox } from "@jsenv/router";

export const DatabaseValue = ({ tableName, column, value, ...rest }) => {
  if (column.name === "tablename") {
    return <TableNameValue name={value} />;
  }
  if (column.data_type === "boolean") {
    return (
      <BooleanValue
        tableName={tableName}
        columnName={column.column_name}
        isWritable
        checked={value}
        {...rest}
      />
    );
  }
  return String(value);
};

const TableNameValue = ({ name }) => {
  return <span>{name}</span>;
};

const BooleanValue = ({
  tableName,
  columnName,
  isWritable,
  checked,
  putRoute,
}) => {
  const putTablePropUrl = useRouteUrl(putRoute, {
    tableName,
    columnName,
  });
  return (
    <SPACheckbox
      action={putTablePropUrl}
      method="PUT"
      disabled={!isWritable}
      checked={checked}
    />
  );
};
