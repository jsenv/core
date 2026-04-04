import { useState } from "preact/hooks";

import { Box, Button, Checkbox, Input, Text } from "@jsenv/navi";

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
        <Box flex="y" spacing="xs">
          <Text bold uppercase size="xxs" color="#6c757d">
            Name
          </Text>
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
        </Box>

        <DataTypeField
          // tablename={tablename}
          column={column}
        />

        {column.udt_name && column.udt_name !== column.data_type && (
          <Box flex="y" spacing="xs">
            <Text bold uppercase size="xxs" color="#6c757d">
              UDT name
            </Text>
            <Input readOnly value={column.udt_name} />
          </Box>
        )}

        {/* Nullable */}
        <Box flex="y" spacing="xxs">
          <Box flex spacing="s" alignY="center">
            <Text bold uppercase size="xxs" color="#6c757d">
              Nullable
            </Text>
            <Checkbox
              appearance="toggle"
              size="xxs"
              readOnly
              checked={isNullable}
            />
          </Box>
          <Text italic size="xxs" color="#868e96">
            When on, this column accepts NULL values. When off, every row must
            provide a value.
          </Text>
        </Box>

        {/* Default */}
        {column.column_default !== null &&
          column.column_default !== undefined && (
            <Box flex="y" spacing="xs">
              <Text bold uppercase size="xxs" color="#6c757d">
                Default
              </Text>
              <Input readOnly value={column.column_default} />
              <Text italic size="xxs" color="#868e96">
                The value PostgreSQL inserts when no value is provided for this
                column.
              </Text>
            </Box>
          )}

        {/* Max length */}
        {column.character_maximum_length !== null &&
          column.character_maximum_length !== undefined && (
            <Box flex="y" spacing="xs">
              <Text bold uppercase size="xxs" color="#6c757d">
                Max length
              </Text>
              <Input
                type="number"
                readOnly
                value={column.character_maximum_length}
              />
            </Box>
          )}

        {/* Precision / Scale */}
        {column.numeric_precision !== null &&
          column.numeric_precision !== undefined &&
          column.numeric_precision_radix === 10 && (
            <Box flex="y" spacing="xs">
              <Text bold uppercase size="xxs" color="#6c757d">
                Precision
              </Text>
              <Input type="number" readOnly value={column.numeric_precision} />
            </Box>
          )}

        {column.numeric_scale !== null &&
          column.numeric_scale !== undefined &&
          column.numeric_precision_radix === 10 && (
            <Box flex="y" spacing="xs">
              <Text bold uppercase size="xxs" color="#6c757d">
                Scale
              </Text>
              <Input type="number" readOnly value={column.numeric_scale} />
            </Box>
          )}

        {/* Datetime precision */}
        {column.datetime_precision !== null &&
          column.datetime_precision !== undefined && (
            <Box flex="y" spacing="xs">
              <Text bold uppercase size="xxs" color="#6c757d">
                Datetime precision
              </Text>
              <Input type="number" readOnly value={column.datetime_precision} />
            </Box>
          )}

        {/* Interval type */}
        {column.interval_type !== null &&
          column.interval_type !== undefined && (
            <Box flex="y" spacing="xs">
              <Text bold uppercase size="xxs" color="#6c757d">
                Interval type
              </Text>
              <Input readOnly value={column.interval_type} />
            </Box>
          )}

        {/* Identity */}
        <Box flex="y" spacing="xxs">
          <Box flex spacing="s" alignY="center">
            <Text bold uppercase size="xxs" color="#6c757d">
              Identity
            </Text>
            <Checkbox
              appearance="toggle"
              size="xxs"
              readOnly
              checked={isIdentity}
            />
          </Box>
          <Text italic size="xxs" color="#868e96">
            When on, the database auto-increments this column. You cannot insert
            a value manually (like SERIAL but SQL-standard).
          </Text>
        </Box>

        {isIdentity && column.identity_generation && (
          <Box flex="y" spacing="xs">
            <Text bold uppercase size="xxs" color="#6c757d">
              Identity generation
            </Text>
            <Input readOnly value={column.identity_generation} />
            <Text italic size="xxs" color="#868e96">
              ALWAYS: the database always generates the value, manual inserts
              are rejected. BY DEFAULT: it generates it but you can still
              provide an explicit value.
            </Text>
          </Box>
        )}

        {/* Generated */}
        <Box flex="y" spacing="xxs">
          <Box flex spacing="s" alignY="center">
            <Text bold uppercase size="xxs" color="#6c757d">
              Generated
            </Text>
            <Checkbox
              appearance="toggle"
              size="xxs"
              readOnly
              checked={isGenerated}
              action={() => {}}
            />
          </Box>
          <Text italic size="xxs" color="#868e96">
            When on, the column value is computed from other columns via an
            expression and cannot be set manually.
          </Text>
        </Box>

        {isGenerated && column.generation_expression && (
          <Box flex="y" spacing="xs">
            <Text bold uppercase size="xxs" color="#6c757d">
              Generation expression
            </Text>
            <Input readOnly value={column.generation_expression} />
          </Box>
        )}

        {/* Updatable */}
        <Box flex="y" spacing="xs">
          <Box flex spacing="s" alignY="center">
            <Text bold uppercase size="xxs" color="#6c757d">
              Updatable
            </Text>
            <Checkbox
              appearance="toggle"
              size="xxs"
              readOnly
              checked={isUpdatable}
              action={() => {}}
            />
          </Box>
          <Text italic size="xxs" color="#868e96">
            When off, this column cannot be modified after the row is created
            (e.g. in non-updatable views, or ALWAYS identity columns).
          </Text>
        </Box>
      </Box>

      {/* Delete */}
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

const DataTypeField = ({
  // tablename,
  column,
}) => {
  const currentMaster = getMasterType(column.data_type) || "Other";
  const [
    selectedMaster,
    // setSelectedMaster
  ] = useState(currentMaster);
  const preciseTypes = DATA_TYPE_GROUPS[selectedMaster];

  const handleMasterChange = async () => {
    // const newMaster = e.currentTarget.value;
    // setSelectedMaster(newMaster);
    // const defaultType = DATA_TYPE_DEFAULTS[newMaster];
    // await TABLE_COLUMN.PUT({
    //   tablename,
    //   columnName: column.column_name,
    //   propertyName: "data_type",
    //   propertyValue: defaultType,
    // });
  };

  const handlePreciseChange = async () => {
    // await TABLE_COLUMN.PUT({
    //   tablename,
    //   columnName: column.column_name,
    //   propertyName: "data_type",
    //   propertyValue: e.currentTarget.value,
    // });
  };

  const currentPrecise = preciseTypes.includes(column.data_type)
    ? column.data_type
    : DATA_TYPE_DEFAULTS[selectedMaster];

  return (
    <Box flex="y" spacing="xs">
      <Text bold uppercase size="xxs" color="#6c757d">
        Data type
      </Text>
      <Box spacing="xs">
        <select value={selectedMaster} onChange={handleMasterChange}>
          {Object.keys(DATA_TYPE_GROUPS).map((master) => (
            <option key={master} value={master}>
              {master}
            </option>
          ))}
          {!getMasterType(column.data_type) && (
            <option value="Other">Other</option>
          )}
        </select>
        {preciseTypes.length > 1 && (
          <select value={currentPrecise} onChange={handlePreciseChange}>
            {preciseTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        )}
      </Box>
      <Text italic size="xxs" color="#868e96">
        {DATA_TYPE_DESCRIPTIONS[selectedMaster]}
      </Text>
    </Box>
  );
};

const DATA_TYPE_GROUPS = {
  "Number": [
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
  ],
  "Text": ["char", "varchar", "text"],
  "Boolean": ["boolean"],
  "Date & Time": [
    "date",
    "time",
    "time with time zone",
    "timestamp",
    "timestamp with time zone",
    "interval",
  ],
  "JSON": ["json", "jsonb"],
  "Binary": ["bytea", "bit", "bit varying"],
  "Network": ["cidr", "inet", "macaddr"],
  "Other": ["uuid", "xml", "ARRAY"],
};

const DATA_TYPE_DEFAULTS = {
  "Number": "integer",
  "Text": "text",
  "Boolean": "boolean",
  "Date & Time": "timestamp",
  "JSON": "jsonb",
  "Binary": "bytea",
  "Network": "inet",
  "Other": "uuid",
};

const DATA_TYPE_DESCRIPTIONS = {
  "Number":
    "Whole numbers (integer, bigint) or decimals (numeric, decimal). Use serial/bigserial for auto-incrementing IDs.",
  "Text":
    "text for unlimited length, varchar(n) for a max length limit, char(n) for fixed-length.",
  "Boolean": "Stores true/false values.",
  "Date & Time":
    "timestamp for date+time, date for date only, time for time only. Add 'with time zone' to store timezone info.",
  "JSON":
    "jsonb (recommended) stores parsed binary JSON with indexing support. json stores raw text.",
  "Binary":
    "bytea for arbitrary binary data. bit/bit varying for fixed or variable-length bit strings.",
  "Network":
    "inet for IPv4/IPv6 addresses, cidr for network ranges, macaddr for MAC addresses.",
  "Other": "uuid for unique identifiers, xml for XML data, ARRAY for arrays.",
};

const getMasterType = (dataType) => {
  for (const [master, types] of Object.entries(DATA_TYPE_GROUPS)) {
    if (types.includes(dataType)) return master;
  }
  return null;
};
