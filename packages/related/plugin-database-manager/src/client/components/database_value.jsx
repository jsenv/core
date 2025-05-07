import {
  SPACheckbox,
  SPAInputDateAndTime,
  SPAInputInteger,
  SPAInputText,
} from "@jsenv/router";

export const DatabaseValue = ({ column, ...rest }) => {
  if (column.name === "tablename") {
    const { value } = rest;
    return <TableNameValue name={value} />;
  }
  if (column.data_type === "boolean") {
    const { value, ...props } = rest;
    return <SPACheckbox checked={value} {...props} />;
  }
  if (column.data_type === "timestamp with time zone") {
    const props = rest;
    return <SPAInputDateAndTime {...props} />;
  }
  if (column.data_type === "integer") {
    const props = rest;
    return <SPAInputInteger {...props} />;
  }
  if (column.data_type === "name") {
    const props = rest;
    return <SPAInputText {...props} />;
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
    return <SPAInputText {...rest} />;
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
  const { value } = rest;
  return String(value);
};

const TableNameValue = ({ name }) => {
  return <span>{name}</span>;
};
