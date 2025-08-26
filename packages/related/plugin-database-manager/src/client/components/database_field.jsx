import { Button, Field, Form, Input, Select, useSignalSync } from "@jsenv/navi";
import { useCallback, useState } from "preact/hooks";
import { RoleLink } from "../role/role_link.jsx";

export const DatabaseFieldset = ({
  item,
  columns,
  usePutAction,
  customFields = {},
  ignoredFields = [],
}) => {
  columns.sort((a, b) => {
    return a.ordinal_position - b.ordinal_position;
  });
  return (
    <ul>
      {columns.map((column) => {
        const columnName = column.column_name;
        if (ignoredFields.includes(columnName)) {
          return null;
        }
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
  const value = item ? item[columnName] : "";
  const valueSignal = useSignalSync(value);
  const putAction = usePutAction(columnName, valueSignal);

  return (
    <DatabaseField
      label={<span>{columnName}:</span>}
      column={column}
      action={putAction}
      valueSignal={valueSignal}
    />
  );
};

export const useDatabaseInputProps = ({ column, valueSignal }) => {
  const columnName = column.column_name;
  if (column.data_type === "boolean") {
    return {
      type: "checkbox",
      name: columnName,
      checkedSignal: valueSignal,
    };
  }
  if (column.data_type === "timestamp with time zone") {
    return {
      type: "datetime-local",
      name: columnName,
    };
  }
  if (column.data_type === "integer") {
    return {
      type: "number",
      name: columnName,
      min: 0,
      step: 1,
    };
  }
  if (column.data_type === "name") {
    return {
      type: "text",
      name: columnName,
      required: true,
    };
  }
  if (column.data_type === "text") {
    return {
      type: "text",
      name: columnName,
    };
  }
  if (column.data_type === "oid") {
    return {};
  }
  if (column.column_name === "rolpassword") {
    return {
      type: "text",
      name: columnName,
    };
  }
  if (column.column_name === "rolconfig") {
    // rolconfig something custom like client_min_messages
    // see https://www.postgresql.org/docs/14/config-setting.html#CONFIG-SETTING-NAMES-VALUES
    return {};
  }
  if (column.data_type === "xid") {
    return {
      type: "text",
      readOnly: true,
      name: columnName,
    };
  }
  if (column.column_name === "datacl") {
    // datacl is a custom type
    // see https://www.postgresql.org/docs/14/sql-grant.html
    return {};
  }
  return {};
};

export const DatabaseInput = ({ column, valueSignal, ...rest }) => {
  const inputProps = useDatabaseInputProps({ column, valueSignal });
  return <Input {...inputProps} {...rest} />;
};

export const DatabaseField = ({ column, label, ...rest }) => {
  const columnName = column.column_name;
  if (label === undefined) {
    if (column.data_type === "oid") {
      label = <span>{columnName}: </span>;
    } else if (columnName === "rolconfig") {
      label = <span>{columnName}: </span>;
    } else {
      label = <span>{columnName}:</span>;
    }
  }

  return (
    <Field label={label} input={<DatabaseInput column={column} {...rest} />} />
  );
};
