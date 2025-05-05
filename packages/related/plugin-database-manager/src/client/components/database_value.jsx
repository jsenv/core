import { SPACheckbox } from "@jsenv/router";

export const DatabaseValue = ({ column, value, ...rest }) => {
  if (column.name === "tablename") {
    return <TableNameValue name={value} />;
  }
  if (column.data_type === "boolean") {
    return (
      <BooleanValue
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

const BooleanValue = ({ columnName, isWritable, checked, getAction }) => {
  const action = getAction({ columnName });
  return (
    <SPACheckbox
      action={action}
      method="PUT"
      disabled={!isWritable}
      checked={checked}
    />
  );
};
