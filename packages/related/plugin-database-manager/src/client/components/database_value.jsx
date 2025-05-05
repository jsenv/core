import { SPAForm, useRouteUrl } from "@jsenv/router";

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
    <SPAForm action={putTablePropUrl} method="PUT">
      <input
        type="checkbox"
        disabled={!isWritable}
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
