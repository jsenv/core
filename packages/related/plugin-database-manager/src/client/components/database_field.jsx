import { Field, Input } from "@jsenv/navi";

export const DatabaseField = ({ column, label, ...rest }) => {
  const columnName = column.column_name;

  if (column.name === "tablename") {
    const { value } = rest;
    return <Field label={label} input={<span>{value}</span>} />;
  }
  if (column.data_type === "boolean") {
    const { value, ...props } = rest;
    return (
      <Field
        label={label}
        input={
          <Input type="checkbox" name={columnName} checked={value} {...props} />
        }
      />
    );
  }
  if (column.data_type === "timestamp with time zone") {
    const props = rest;
    return (
      <Field
        label={label}
        input={<Input type="datetime-local" name={columnName} {...props} />}
      />
    );
  }
  if (column.data_type === "integer") {
    const props = rest;
    return (
      <Field
        label={label}
        input={
          <Input type="number" min="0" step="1" name={columnName} {...props} />
        }
      />
    );
  }
  if (column.data_type === "name") {
    const props = rest;
    return (
      <Field
        label={label}
        input={<Input type="text" required name={columnName} {...props} />}
      />
    );
  }
  if (column.data_type === "oid") {
    return (
      <Field
        label={<span>{column.column_name}: </span>}
        input={<span>{rest.value}</span>}
      ></Field>
    );
  }
  if (column.column_name === "rolpassword") {
    return (
      <Field
        label={label}
        input={<Input type="text" name={columnName} {...rest} />}
      />
    );
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
    return (
      <Field
        label={label}
        input={<Input type="text" readOnly name={columnName} {...rest} />}
      />
    );
  }
  if (column.column_name === "datacl") {
    // datacl is a custom type
    // see https://www.postgresql.org/docs/14/sql-grant.html
    return (
      <Field
        label={<span>{column.column_name}: </span>}
        input={<span>{String(rest.value)}</span>}
      />
    );
  }
  const { value } = rest;
  return (
    <Field
      label={<span>{column.column_name}: </span>}
      input={String(value)}
    ></Field>
  );
};
