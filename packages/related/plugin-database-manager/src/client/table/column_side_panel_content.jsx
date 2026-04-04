import { Box, Button, Checkbox, Input, Label } from "@jsenv/navi";

import { TABLE_COLUMN } from "./table_store.js";

import.meta.css = /* css */ `
  .column_side_panel_title {
    color: #212529;
    font-weight: 600;
    font-size: 16px;
  }

  .column_side_panel_subtitle {
    color: #6c757d;
    font-size: 12px;
  }

  .column_field_label_text {
    color: #6c757d;
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .column_field_description {
    color: #868e96;
    font-style: italic;
    font-size: 11px;
    line-height: 1.4;
  }
`;

export const ColumnSidePanelContent = ({ tablename, column, onClose }) => {
  const deleteColumn = TABLE_COLUMN.DELETE.bindParams({
    tablename,
    columnName: column.column_name,
  });
  const isNullable = String(column.is_nullable).toUpperCase() === "YES";
  const isIdentity = String(column.is_identity).toUpperCase() === "YES";
  const isGenerated = String(column.is_generated).toUpperCase() === "ALWAYS";
  const isUpdatable = String(column.is_updatable).toUpperCase() === "YES";

  return (
    <Box column spacing="l" padding="l">
      <Box
        column
        spacing="xs"
        paddingBottom="m"
        style={{ borderBottom: "1px solid #e9ecef" }}
      >
        <span className="column_side_panel_title">Column details</span>
        <span className="column_side_panel_subtitle">{column.column_name}</span>
      </Box>

      <Box column spacing="m">
        <ColumnField
          label="Name"
          description="The identifier used to reference this column in queries."
        >
          <Input
            defaultValue={column.column_name}
            action={async (newName) => {
              if (newName && newName !== column.column_name) {
                await TABLE_COLUMN.PUT({
                  tablename,
                  columnName: column.column_name,
                  propertyName: "column_name",
                  propertyValue: newName,
                });
              }
            }}
          />
        </ColumnField>

        <ColumnField
          label="Data type"
          description="The PostgreSQL data type stored in this column."
        >
          <select
            value={column.data_type}
            onChange={async (e) => {
              await TABLE_COLUMN.PUT({
                tablename,
                columnName: column.column_name,
                propertyName: "data_type",
                propertyValue: e.currentTarget.value,
              });
            }}
          >
            {POSTGRES_DATA_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
            {!POSTGRES_DATA_TYPES.includes(column.data_type) && (
              <option value={column.data_type}>{column.data_type}</option>
            )}
          </select>
        </ColumnField>

        {column.udt_name && column.udt_name !== column.data_type && (
          <ColumnField
            label="UDT name"
            description="The underlying PostgreSQL type name (e.g. int4, varchar). Reflects the actual storage type."
          >
            <Input readOnly value={column.udt_name} />
          </ColumnField>
        )}

        <ColumnField
          label="Nullable"
          description="When checked, this column accepts NULL values. When unchecked, every row must provide a value."
        >
          <Label spacing="s">
            <Checkbox readOnly checked={isNullable} />
            {isNullable ? "Accepts NULL" : "Required (NOT NULL)"}
          </Label>
        </ColumnField>

        {column.column_default !== null &&
          column.column_default !== undefined && (
            <ColumnField
              label="Default"
              description="The value PostgreSQL inserts when no value is provided for this column."
            >
              <Input readOnly value={column.column_default} />
            </ColumnField>
          )}

        {column.character_maximum_length !== null &&
          column.character_maximum_length !== undefined && (
            <ColumnField label="Max length">
              <Input
                type="number"
                readOnly
                value={column.character_maximum_length}
              />
            </ColumnField>
          )}

        {column.numeric_precision !== null &&
          column.numeric_precision !== undefined &&
          column.numeric_precision_radix === 10 && (
            <ColumnField label="Precision">
              <Input type="number" readOnly value={column.numeric_precision} />
            </ColumnField>
          )}

        {column.numeric_scale !== null &&
          column.numeric_scale !== undefined &&
          column.numeric_precision_radix === 10 && (
            <ColumnField label="Scale">
              <Input type="number" readOnly value={column.numeric_scale} />
            </ColumnField>
          )}

        {column.datetime_precision !== null &&
          column.datetime_precision !== undefined && (
            <ColumnField label="Datetime precision">
              <Input type="number" readOnly value={column.datetime_precision} />
            </ColumnField>
          )}

        {column.interval_type !== null &&
          column.interval_type !== undefined && (
            <ColumnField label="Interval type">
              <Input readOnly value={column.interval_type} />
            </ColumnField>
          )}

        <ColumnField
          label="Identity"
          description="An identity column is auto-incremented by PostgreSQL. The database generates its value — you cannot insert one manually (like SERIAL but SQL-standard)."
        >
          <Label spacing="s">
            <Checkbox readOnly checked={isIdentity} />
            {isIdentity
              ? "Auto-incremented by the database"
              : "Not an identity column"}
          </Label>
        </ColumnField>

        {isIdentity && column.identity_generation && (
          <ColumnField
            label="Identity generation"
            description="ALWAYS: the database always generates the value, manual inserts are rejected. BY DEFAULT: the database generates it but you can still provide an explicit value."
          >
            <Input readOnly value={column.identity_generation} />
          </ColumnField>
        )}

        <ColumnField
          label="Generated"
          description="A generated column is computed from other columns via an expression. Its value is calculated automatically and cannot be set manually."
        >
          <Label spacing="s">
            <Checkbox readOnly checked={isGenerated} />
            {isGenerated ? "Computed from an expression" : "Stored directly"}
          </Label>
        </ColumnField>

        {isGenerated && column.generation_expression && (
          <ColumnField label="Generation expression">
            <Input readOnly value={column.generation_expression} />
          </ColumnField>
        )}

        <ColumnField
          label="Updatable"
          description="When unchecked, this column cannot be modified after the row is created (e.g. columns in non-updatable views, or ALWAYS identity columns)."
        >
          <Label spacing="s">
            <Checkbox readOnly checked={isUpdatable} />
            {isUpdatable ? "Can be updated" : "Read-only after insert"}
          </Label>
        </ColumnField>
      </Box>

      <Box paddingTop="m" style={{ borderTop: "1px solid #e9ecef" }}>
        <Button
          data-confirm-message={`Are you sure you want to delete the column "${column.column_name}"? This will permanently remove the column and all its data.`}
          action={async () => {
            await deleteColumn();
            onClose();
          }}
        >
          Delete column
        </Button>
      </Box>
    </Box>
  );
};

const ColumnField = ({ label, description, children }) => (
  <Box column spacing="xs">
    <span className="column_field_label_text">{label}</span>
    {children}
    {description && (
      <span className="column_field_description">{description}</span>
    )}
  </Box>
);

const POSTGRES_DATA_TYPES = [
  "smallint",
  "integer",
  "bigint",
  "decimal",
  "numeric",
  "real",
  "double precision",
  "serial",
  "bigserial",
  "boolean",
  "char",
  "varchar",
  "text",
  "bytea",
  "date",
  "time",
  "time with time zone",
  "timestamp",
  "timestamp with time zone",
  "interval",
  "uuid",
  "json",
  "jsonb",
  "xml",
  "cidr",
  "inet",
  "macaddr",
  "bit",
  "bit varying",
  "money",
  "ARRAY",
];
