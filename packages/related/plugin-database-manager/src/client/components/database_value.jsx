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
  const { value } = rest;
  return String(value);
};

const TableNameValue = ({ name }) => {
  return <span>{name}</span>;
};
