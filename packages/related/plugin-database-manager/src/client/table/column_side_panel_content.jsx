import { Box, Button, Checkbox, Input, Label, Text } from "@jsenv/navi";

import { TABLE_COLUMN } from "./table_store.js";

export const ColumnSidePanelContent = ({ tablename, column }) => {
  const isNullable = String(column.is_nullable).toUpperCase() === "YES";
  const isIdentity = String(column.is_identity).toUpperCase() === "YES";
  const isGenerated = String(column.is_generated).toUpperCase() === "ALWAYS";
  const isUpdatable = String(column.is_updatable).toUpperCase() === "YES";

  return (
    <Box flex="y" spacing="l" padding="l">
      <Box
        flex="y"
        spacing="xs"
        paddingBottom="m"
        style={{ borderBottom: "1px solid #e9ecef" }}
      >
        <Text bold size="m">
          Column details
        </Text>
        <Text size="xs" color="#6c757d">
          {column.column_name}
        </Text>
      </Box>

      <Box flex="y" spacing="m">
        <ColumnField label="Name">
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

        <ColumnField label="Data type">
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
            <optgroup label="Numeric">
              <option value="smallint">smallint</option>
              <option value="integer">integer</option>
              <option value="bigint">bigint</option>
              <option value="decimal">decimal</option>
              <option value="numeric">numeric</option>
              <option value="real">real</option>
              <option value="double precision">double precision</option>
              <option value="serial">serial</option>
              <option value="bigserial">bigserial</option>
              <option value="money">money</option>
            </optgroup>
            <optgroup label="Text">
              <option value="char">char</option>
              <option value="varchar">varchar</option>
              <option value="text">text</option>
            </optgroup>
            <optgroup label="Boolean">
              <option value="boolean">boolean</option>
            </optgroup>
            <optgroup label="Date &amp; Time">
              <option value="date">date</option>
              <option value="time">time</option>
              <option value="time with time zone">time with time zone</option>
              <option value="timestamp">timestamp</option>
              <option value="timestamp with time zone">
                timestamp with time zone
              </option>
              <option value="interval">interval</option>
            </optgroup>
            <optgroup label="JSON">
              <option value="json">json</option>
              <option value="jsonb">jsonb</option>
            </optgroup>
            <optgroup label="Binary">
              <option value="bytea">bytea</option>
              <option value="bit">bit</option>
              <option value="bit varying">bit varying</option>
            </optgroup>
            <optgroup label="Network">
              <option value="cidr">cidr</option>
              <option value="inet">inet</option>
              <option value="macaddr">macaddr</option>
            </optgroup>
            <optgroup label="Other">
              <option value="uuid">uuid</option>
              <option value="xml">xml</option>
              <option value="ARRAY">ARRAY</option>
            </optgroup>
            {!ALL_POSTGRES_DATA_TYPES.includes(column.data_type) && (
              <optgroup label="Current">
                <option value={column.data_type}>{column.data_type}</option>
              </optgroup>
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
            await TABLE_COLUMN.DELETE({
              tablename,
              columnName: column.column_name,
            });
          }}
        >
          Delete column
        </Button>
      </Box>
    </Box>
  );
};

const ColumnField = ({ label, description, children }) => (
  <Box flex="y" spacing="xs">
    <Text bold uppercase size="xxs" color="#6c757d">
      {label}
    </Text>
    {children}
    {description && (
      <Text italic size="xxs" color="#868e96">
        {description}
      </Text>
    )}
  </Box>
);

const ALL_POSTGRES_DATA_TYPES = [
  "smallint",
  "integer",
  "bigint",
  "decimal",
  "numeric",
  "real",
  "double precision",
  "serial",
  "bigserial",
  "money",
  "char",
  "varchar",
  "text",
  "boolean",
  "date",
  "time",
  "time with time zone",
  "timestamp",
  "timestamp with time zone",
  "interval",
  "json",
  "jsonb",
  "bytea",
  "bit",
  "bit varying",
  "cidr",
  "inet",
  "macaddr",
  "uuid",
  "xml",
  "ARRAY",
];
