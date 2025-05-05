import { SPACheckbox } from "@jsenv/router";

export const DatabaseValue = ({ label, column, value, ...rest }) => {
  if (column.name === "tablename") {
    return <TableNameValue name={value} />;
  }
  if (column.data_type === "boolean") {
    return (
      <BooleanValue
        columnName={column.column_name}
        label={label}
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
  columnName,
  isWritable,
  checked,
  getAction,
  ...rest
}) => {
  const action = getAction({ columnName });
  return (
    <SPACheckbox
      method="PUT"
      action={action}
      disabled={!isWritable}
      checked={checked}
      {...rest}
    />
  );
};
