import { useState } from "preact/hooks";

import { Box, Button, Checkbox, Input, Label, Text } from "@jsenv/navi";

import { TABLE_COLUMN } from "./table_store.js";

export const ColumnSidePanelContent = ({ tablename, column }) => {
  const isNullable = String(column.is_nullable).toUpperCase() === "YES";
  const isIdentity = String(column.is_identity).toUpperCase() === "YES";
  const isGenerated = String(column.is_generated).toUpperCase() === "ALWAYS";
  const isUpdatable = String(column.is_updatable).toUpperCase() === "YES";

  const putColumn = (propertyName, propertyValue) => {
    // TABLE_COLUMN.PUT({
    //   tablename,
    //   columnName: column.column_name,
    //   propertyName,
    //   propertyValue,
    // });
  };

  return (
    <Box flex="y" spacing="l" padding="l">
      {/* Header */}
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
        {/* Name */}
        <Box flex="y" spacing="xs">
          <Text bold uppercase size="xxs" color="#6c757d">
            Name
          </Text>
          <Input
            defaultValue={column.column_name}
            action={async (newName) => {
              if (newName && newName !== column.column_name) {
                await putColumn("column_name", newName);
              }
            }}
          />
          <Text italic size="xxs" color="#868e96">
            The identifier used to reference this column in queries.
          </Text>
        </Box>

        {/* Data type */}
        <DataTypeField column={column} putColumn={putColumn} />

        {/* UDT name */}
        {column.udt_name && column.udt_name !== column.data_type && (
          <Box flex="y" spacing="xs">
            <Text bold uppercase size="xxs" color="#6c757d">
              UDT name
            </Text>
            <Input readOnly value={column.udt_name} />
            <Text italic size="xxs" color="#868e96">
              The underlying PostgreSQL type name (e.g. int4, varchar). Reflects
              the actual storage type.
            </Text>
          </Box>
        )}

        {/* Nullable */}
        <Box flex="y" spacing="xs">
          <Box spacing="s" alignY="center">
            <Text bold uppercase size="xxs" color="#6c757d">
              Nullable
            </Text>
            <Checkbox appearance="toggle" readOnly checked={isNullable} />
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
        <Box flex="y" spacing="xs">
          <Box spacing="s" alignY="center">
            <Text bold uppercase size="xxs" color="#6c757d">
              Identity
            </Text>
            <Checkbox appearance="toggle" readOnly checked={isIdentity} />
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
        <Box flex="y" spacing="xs">
          <Box spacing="s" alignY="center">
            <Text bold uppercase size="xxs" color="#6c757d">
              Generated
            </Text>
            <Checkbox appearance="toggle" readOnly checked={isGenerated} />
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
          <Box spacing="s" alignY="center">
            <Text bold uppercase size="xxs" color="#6c757d">
              Updatable
            </Text>
            <Checkbox appearance="toggle" readOnly checked={isUpdatable} />
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

const FieldLabel = ({ children }) => (
  <Text bold uppercase size="xxs" color="#6c757d">
    {children}
  </Text>
);
const FieldDescription = ({ children }) => (
  <Text italic size="xxs" color="#868e96">
    {children}
  </Text>
);

// ─── Data type field ──────────────────────────────────────────────────────────

const DataTypeField = ({ column, putColumn }) => {
  const currentMaster = getMasterType(column.data_type) || "Other";
  const [selectedMaster, setSelectedMaster] = useState(currentMaster);

  const handleMasterChange = async (e) => {
    const newMaster = e.currentTarget.value;
    setSelectedMaster(newMaster);
    await putColumn("data_type", DATA_TYPE_DEFAULTS[newMaster]);
  };

  return (
    <Box flex="y" spacing="xs">
      <FieldLabel>Data type</FieldLabel>
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
      <DataTypeOptions
        master={selectedMaster}
        column={column}
        putColumn={putColumn}
      />
    </Box>
  );
};

const DataTypeOptions = ({ master, column, putColumn }) => {
  if (master === "Text") {
    return <TextTypeOptions column={column} putColumn={putColumn} />;
  }
  if (master === "Number") {
    return <NumberTypeOptions column={column} putColumn={putColumn} />;
  }
  if (master === "Date & Time") {
    return <DateTimeTypeOptions column={column} putColumn={putColumn} />;
  }
  if (master === "Binary") {
    return <BinaryTypeOptions column={column} putColumn={putColumn} />;
  }
  const description = DATA_TYPE_DESCRIPTIONS[master];
  if (description) {
    return <FieldDescription>{description}</FieldDescription>;
  }
  return null;
};

// Text: text (unlimited) | varchar(n) (variable length) | char(n) (fixed length)
const TextTypeOptions = ({ column, putColumn }) => {
  const currentLength = column.character_maximum_length ?? null;
  const isVariable = column.data_type !== "char";
  const [length, setLength] = useState(
    currentLength ? String(currentLength) : "",
  );
  const [variable, setVariable] = useState(isVariable);

  const applyType = async (newLength, newVariable) => {
    let type;
    if (!newLength) {
      type = "text";
    } else if (newVariable) {
      type = `varchar(${newLength})`;
    } else {
      type = `char(${newLength})`;
    }
    await putColumn("data_type", type);
  };

  return (
    <Box flex="y" spacing="s">
      <Box flex="y" spacing="xs">
        <FieldLabel>Max length</FieldLabel>
        <Input
          type="number"
          placeholder="Unlimited"
          value={length}
          action={async (newValue) => {
            const newLength = newValue
              ? String(Math.floor(Number(newValue)))
              : "";
            setLength(newLength);
            await applyType(newLength, variable);
          }}
        />
        <FieldDescription>
          Leave empty for unlimited text. Set a value to enforce a max length.
        </FieldDescription>
      </Box>
      {length && (
        <Box flex="y" spacing="xs">
          <Box spacing="s" alignY="center">
            <FieldLabel>Variable length</FieldLabel>
            <Checkbox
              appearance="toggle"
              checked={variable}
              action={async (newChecked) => {
                setVariable(newChecked);
                await applyType(length, newChecked);
              }}
            />
          </Box>
          <FieldDescription>
            On: varchar — stores up to max length (saves space). Off: char —
            always pads to exact length.
          </FieldDescription>
        </Box>
      )}
    </Box>
  );
};

// Number: integer types (no extra config) vs decimal/numeric (precision + scale)
const NumberTypeOptions = ({ column, putColumn }) => {
  const isDecimal =
    column.data_type === "decimal" || column.data_type === "numeric";
  const integerTypes = ["smallint", "integer", "bigint", "serial", "bigserial"];
  const decimalTypes = [
    "decimal",
    "numeric",
    "real",
    "double precision",
    "money",
  ];
  const currentGroup = decimalTypes.includes(column.data_type)
    ? "decimal"
    : "integer";
  const [group, setGroup] = useState(currentGroup);

  const handleGroupChange = async (e) => {
    const newGroup = e.currentTarget.value;
    setGroup(newGroup);
    await putColumn(
      "data_type",
      newGroup === "integer" ? "integer" : "numeric",
    );
  };

  return (
    <Box flex="y" spacing="s">
      <select value={group} onChange={handleGroupChange}>
        <option value="integer">Integer (whole numbers)</option>
        <option value="decimal">Decimal (fractional numbers)</option>
      </select>

      {group === "integer" && (
        <Box flex="y" spacing="xs">
          <FieldLabel>Size</FieldLabel>
          <select
            value={
              integerTypes.includes(column.data_type)
                ? column.data_type
                : "integer"
            }
            onChange={async (e) => {
              await putColumn("data_type", e.currentTarget.value);
            }}
          >
            <option value="smallint">smallint — 2 bytes, up to 32 767</option>
            <option value="integer">integer — 4 bytes, up to 2 billion</option>
            <option value="bigint">bigint — 8 bytes, very large numbers</option>
            <option value="serial">serial — auto-increment integer</option>
            <option value="bigserial">bigserial — auto-increment bigint</option>
          </select>
        </Box>
      )}

      {group === "decimal" && (
        <Box flex="y" spacing="xs">
          <FieldLabel>Type</FieldLabel>
          <select
            value={
              decimalTypes.includes(column.data_type)
                ? column.data_type
                : "numeric"
            }
            onChange={async (e) => {
              await putColumn("data_type", e.currentTarget.value);
            }}
          >
            <option value="numeric">
              numeric — exact precision (configurable)
            </option>
            <option value="decimal">decimal — alias for numeric</option>
            <option value="real">real — 4-byte floating point</option>
            <option value="double precision">
              double precision — 8-byte floating point
            </option>
            <option value="money">
              money — currency with fixed 2 decimal places
            </option>
          </select>
          {(isDecimal || column.data_type === "numeric") && (
            <Box flex="y" spacing="xs">
              <FieldDescription>
                Optional precision (total digits) and scale (decimal digits) for
                numeric/decimal.
              </FieldDescription>
              <Box spacing="s">
                <Box flex="y" spacing="xs">
                  <FieldLabel>Precision</FieldLabel>
                  <Input
                    type="number"
                    placeholder="Any"
                    readOnly
                    value={column.numeric_precision ?? ""}
                  />
                </Box>
                <Box flex="y" spacing="xs">
                  <FieldLabel>Scale</FieldLabel>
                  <Input
                    type="number"
                    placeholder="0"
                    readOnly
                    value={column.numeric_scale ?? ""}
                  />
                </Box>
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

// Date & Time: base type select + optional timezone toggle
const DateTimeTypeOptions = ({ column, putColumn }) => {
  const baseType = getDateTimeBase(column.data_type);
  const hasTimezone = column.data_type.includes("with time zone");

  const applyType = async (newBase, newTimezone) => {
    let type = newBase;
    if (newTimezone && (newBase === "time" || newBase === "timestamp")) {
      type = `${newBase} with time zone`;
    }
    await putColumn("data_type", type);
  };

  return (
    <Box flex="y" spacing="s">
      <select
        value={baseType}
        onChange={async (e) => {
          await applyType(e.currentTarget.value, hasTimezone);
        }}
      >
        <option value="date">date — calendar date (no time)</option>
        <option value="time">time — time of day (no date)</option>
        <option value="timestamp">timestamp — date and time</option>
        <option value="interval">interval — duration / time span</option>
      </select>
      {(baseType === "time" || baseType === "timestamp") && (
        <Box flex="y" spacing="xs">
          <Box spacing="s" alignY="center">
            <FieldLabel>With timezone</FieldLabel>
            <Checkbox
              appearance="toggle"
              checked={hasTimezone}
              action={async (newChecked) => {
                await applyType(baseType, newChecked);
              }}
            />
          </Box>
          <FieldDescription>
            When on, stores the timezone offset alongside the value. Recommended
            for user-facing timestamps.
          </FieldDescription>
        </Box>
      )}
    </Box>
  );
};

const getDateTimeBase = (dataType) => {
  if (dataType.startsWith("timestamp")) return "timestamp";
  if (dataType.startsWith("time")) return "time";
  return dataType; // date, interval
};

// Binary: bytea (raw bytes) or bit/bit varying (bit strings with length)
const BinaryTypeOptions = ({ column, putColumn }) => {
  const isBit =
    column.data_type === "bit" || column.data_type === "bit varying";
  const currentLength = column.character_maximum_length ?? null;
  const isVariable = column.data_type === "bit varying";
  const [useBit, setUseBit] = useState(isBit);
  const [length, setLength] = useState(
    currentLength ? String(currentLength) : "1",
  );
  const [variable, setVariable] = useState(isVariable);

  const applyBitType = async (newLength, newVariable) => {
    const type = newVariable
      ? `bit varying(${newLength})`
      : `bit(${newLength})`;
    await putColumn("data_type", type);
  };

  return (
    <Box flex="y" spacing="s">
      <Box flex="y" spacing="xs">
        <Box spacing="s" alignY="center">
          <FieldLabel>Bit string</FieldLabel>
          <Checkbox
            appearance="toggle"
            checked={useBit}
            action={async (newChecked) => {
              setUseBit(newChecked);
              if (!newChecked) {
                await putColumn("data_type", "bytea");
              } else {
                await applyBitType(length, variable);
              }
            }}
          />
        </Box>
        <FieldDescription>
          Off: bytea stores arbitrary binary data. On: bit string stores a
          sequence of 0s and 1s.
        </FieldDescription>
      </Box>
      {useBit && (
        <>
          <Box flex="y" spacing="xs">
            <FieldLabel>Length</FieldLabel>
            <Input
              type="number"
              value={length}
              action={async (newValue) => {
                const newLength = newValue
                  ? String(Math.floor(Number(newValue)))
                  : "1";
                setLength(newLength);
                await applyBitType(newLength, variable);
              }}
            />
          </Box>
          <Box flex="y" spacing="xs">
            <Box spacing="s" alignY="center">
              <FieldLabel>Variable length</FieldLabel>
              <Checkbox
                appearance="toggle"
                checked={variable}
                action={async (newChecked) => {
                  setVariable(newChecked);
                  await applyBitType(length, newChecked);
                }}
              />
            </Box>
            <FieldDescription>
              On: bit varying — up to max length. Off: bit — exactly that many
              bits.
            </FieldDescription>
          </Box>
        </>
      )}
    </Box>
  );
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DATA_TYPE_GROUPS = {
  "Text": ["text", "varchar", "char"],
  "Number": [
    "smallint",
    "integer",
    "bigint",
    "serial",
    "bigserial",
    "decimal",
    "numeric",
    "real",
    "double precision",
    "money",
  ],
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
  "Text": "text",
  "Number": "integer",
  "Boolean": "boolean",
  "Date & Time": "timestamp",
  "JSON": "jsonb",
  "Binary": "bytea",
  "Network": "inet",
  "Other": "uuid",
};

const DATA_TYPE_DESCRIPTIONS = {
  Boolean: "Stores true/false values.",
  JSON: "jsonb (recommended) stores binary JSON with index support. json stores raw text.",
  Network:
    "inet for IP addresses, cidr for network ranges, macaddr for MAC addresses.",
  Other:
    "uuid for unique identifiers, xml for XML data, ARRAY for typed arrays.",
};

const getMasterType = (dataType) => {
  const base = dataType.split("(")[0].trim(); // strip char(n) → char
  for (const [master, types] of Object.entries(DATA_TYPE_GROUPS)) {
    if (types.includes(dataType) || types.includes(base)) return master;
  }
  return null;
};
