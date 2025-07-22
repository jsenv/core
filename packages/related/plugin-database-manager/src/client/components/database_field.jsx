import { Button, Field, Form, Input, Select } from "@jsenv/navi";
import { useCallback, useState } from "preact/hooks";
import { RoleLink } from "../role/role_link.jsx";

export const DatabaseFieldset = ({
  item,
  columns,
  usePutAction,
  customFields = {},
}) => {
  columns.sort((a, b) => {
    return a.ordinal_position - b.ordinal_position;
  });
  return (
    <ul>
      {columns.map((column) => {
        const columnName = column.column_name;
        const customField = customFields?.[columnName];
        const dbField = customField ? (
          customField(item)
        ) : (
          <DatabaseFieldWrapper
            item={item}
            column={column}
            usePutAction={usePutAction}
          />
        );
        return <li key={columnName}>{dbField}</li>;
      })}
    </ul>
  );
};

export const RoleField = ({ role }) => {
  const [editing, setEditing] = useState(false);
  const startEditing = useCallback(() => {
    setEditing(true);
  }, []);
  const stopEditing = useCallback(() => {
    setEditing(false);
  }, []);

  return (
    <Field
      label="Owner:"
      input={
        <div style="display: inline-flex; flex-direction: row; gap: 0.5em;">
          {editing ? (
            <Form
              action={() => {
                // TODO
              }}
              onReset={stopEditing}
            >
              <Select value={role.rolname}>
                {[
                  {
                    label: role.rolname,
                    value: role.rolname,
                  },
                ]}
              </Select>
              <Button type="submit">Validate</Button>
              <Button type="reset">Cancel</Button>
            </Form>
          ) : (
            <>
              <RoleLink role={role}>{role.rolname}</RoleLink>
              <Button action={startEditing}>Change</Button>
            </>
          )}
        </div>
      }
    />
  );
};

const DatabaseFieldWrapper = ({ item, column, usePutAction }) => {
  const columnName = column.column_name;
  const putAction = usePutAction(columnName);
  const value = item ? item[columnName] : "";

  return (
    <DatabaseField
      label={<span>{columnName}:</span>}
      column={column}
      value={value}
      action={putAction}
    />
  );
};
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
      <Field label={label} input={<Input type="text" required {...props} />} />
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
