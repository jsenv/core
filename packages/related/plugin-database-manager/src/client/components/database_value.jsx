import {
  SPAInputCheckbox,
  SPAInputDateAndTime,
  SPAInputInteger,
  SPAInputText,
} from "@jsenv/router";

export const DatabaseValue = ({ column, ...rest }) => {
  const columnName = column.column_name;

  if (column.name === "tablename") {
    const { value } = rest;
    return <TableNameValue name={value} />;
  }
  if (column.data_type === "boolean") {
    const { value, ...props } = rest;
    return <SPAInputCheckbox name={columnName} checked={value} {...props} />;
  }
  if (column.data_type === "timestamp with time zone") {
    const props = rest;
    return <SPAInputDateAndTime name={columnName} {...props} />;
  }
  if (column.data_type === "integer") {
    const props = rest;
    return <SPAInputInteger name={columnName} {...props} />;
  }
  if (column.data_type === "name") {
    const props = rest;
    return <SPAInputText required name={columnName} {...props} />;
  }
  if (column.data_type === "oid") {
    return (
      <span>
        <span>{column.column_name}: </span>
        <span>{rest.value}</span>
      </span>
    );
  }
  if (column.column_name === "rolpassword") {
    return <SPAInputText name={columnName} {...rest} />;
  }
  if (column.column_name === "rolconfig") {
    // rolconfig something custom like client_min_messages
    // see https://www.postgresql.org/docs/14/config-setting.html#CONFIG-SETTING-NAMES-VALUES
    return (
      <span>
        <span>{column.column_name}: </span>
        <span>{String(rest.value)}</span>
      </span>
    );
  }
  if (column.data_type === "xid") {
    return <SPAInputText readOnly name={columnName} {...rest} />;
  }
  if (column.column_name === "datacl") {
    // datacl is a custom type
    // see https://www.postgresql.org/docs/14/sql-grant.html
    return (
      <span>
        <span>{column.column_name}: </span>
        <span>{String(rest.value)}</span>
      </span>
    );
  }
  const { value } = rest;
  return String(value);
};

const TableNameValue = ({ name }) => {
  return <span>{name}</span>;
};
