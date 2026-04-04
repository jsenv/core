import { useState } from "preact/hooks";

import {
  Box,
  Button,
  Checkbox,
  Input,
  Label,
  Radio,
  RadioList,
  Text,
} from "@jsenv/navi";

import { TABLE_COLUMN } from "./table_store.js";

export const ColumnSidePanelContent = ({ tablename, column }) => {
  if (!column) {
    return <Text>This column does not exists in the table</Text>;
  }

  const isNullable = String(column.is_nullable).toUpperCase() === "YES";
  const isIdentity = String(column.is_identity).toUpperCase() === "YES";
  const isGenerated = String(column.is_generated).toUpperCase() === "ALWAYS";
  const isUpdatable = String(column.is_updatable).toUpperCase() === "YES";

  const putColumn = (propertyName, propertyValue) => {
    return TABLE_COLUMN.PUT({
      tablename,
      column_name: column.column_name,
      propertyName,
      propertyValue,
    });
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
            value={column.column_name}
            actionAfterChange
            action={async (newName) => {
              await putColumn("column_name", newName);
            }}
          />
          <Text italic size="xxs" color="#868e96">
            The identifier used to reference this column in queries.
          </Text>
        </Box>

        {/* Data type */}
        {isIdentity ? (
          <Box flex="y" spacing="xs">
            <FieldLabel>Data type</FieldLabel>
            <Input readOnly value={column.data_type} />
            <FieldDescription>
              Identity columns are locked to integer types (smallint, integer,
              bigint).
            </FieldDescription>
          </Box>
        ) : (
          <DataTypeField column={column} putColumn={putColumn} />
        )}

        {/* Default */}
        {isIdentity ? (
          column.column_default !== null &&
          column.column_default !== undefined && (
            <Box flex="y" spacing="xs">
              <FieldLabel>Default</FieldLabel>
              <Input readOnly value={column.column_default} />
              <FieldDescription>
                Managed by the identity sequence. Cannot be changed manually.
              </FieldDescription>
            </Box>
          )
        ) : (
          <Box flex="y" spacing="xs">
            <FieldLabel>Default</FieldLabel>
            <Input
              defaultValue={column.column_default ?? ""}
              placeholder="None"
              action={async (newValue) => {
                await putColumn(
                  "default_value",
                  newValue.trim() === "" ? null : newValue.trim(),
                );
              }}
            />
            <FieldDescription>
              Value PostgreSQL inserts when no value is provided. Leave empty to
              remove the default.
            </FieldDescription>
          </Box>
        )}

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

        {/* Nullable — hidden for identity (always NOT NULL) */}
        {!isIdentity && (
          <Box flex="y" spacing="xs">
            <Box flex spacing="s" alignY="center">
              <Text bold uppercase size="xxs" color="#6c757d">
                Nullable
              </Text>
              <Checkbox
                appearance="toggle"
                size="xxs"
                checked={isNullable}
                action={async (v) => {
                  await putColumn("is_nullable", v);
                }}
              />
            </Box>
            <Text italic size="xxs" color="#868e96">
              When on, this column accepts NULL values. When off, every row must
              provide a value.
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
        <Box flex="y" spacing="xxs">
          <Box flex spacing="s" alignY="center">
            <Text bold uppercase size="xxs" color="#6c757d">
              Identity
            </Text>
            <Checkbox
              appearance="toggle"
              size="xxs"
              checked={isIdentity}
              action={async (v) => {
                await putColumn("is_identity", v);
              }}
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

        {/* Generated — hidden for identity (mutually exclusive) */}
        {!isIdentity && (
          <GeneratedField
            column={column}
            isGenerated={isGenerated}
            putColumn={putColumn}
          />
        )}

        {/* Updatable */}
        {!isUpdatable && (
          <Text italic size="xxs" color="#868e96">
            This column is not updatable (e.g. in a non-updatable view or an
            ALWAYS identity column).
          </Text>
        )}
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
  if (master === "Network") {
    return <NetworkTypeOptions column={column} putColumn={putColumn} />;
  }
  if (master === "Other") {
    return <OtherTypeOptions column={column} putColumn={putColumn} />;
  }
  const description = DATA_TYPE_DESCRIPTIONS[master];
  if (description) {
    return <FieldDescription>{description}</FieldDescription>;
  }
  return null;
};

// Text: free text (text) | max length (varchar(n)) | fixed length (char(n))
const TextTypeOptions = ({ column, putColumn }) => {
  const currentLength = column.character_maximum_length ?? null;
  const initialMode =
    column.data_type === "char" ? "fixed" : currentLength ? "max" : "free";
  const [mode, setMode] = useState(initialMode);
  const [length, setLength] = useState(
    currentLength ? String(currentLength) : "",
  );

  const applyType = async (newMode, newLength) => {
    let type;
    if (newMode === "free") {
      type = "text";
    } else if (newMode === "max") {
      type = newLength ? `varchar(${newLength})` : "varchar";
    } else {
      type = newLength ? `char(${newLength})` : "char";
    }
    await putColumn("data_type", type);
  };

  return (
    <Box flex="y" spacing="s">
      <RadioList
        name="text_mode"
        flex="y"
        spacing="xs"
        action={(mode) => {
          setMode(mode);
          return applyType(mode, length);
        }}
      >
        <Label spacing="s" alignY="center">
          <Radio value="free" checked={mode === "free"} />
          Free text
        </Label>
        <Label spacing="s" alignY="center">
          <Radio value="max" checked={mode === "max"} />
          Max length
          {mode === "max" && (
            <Input
              type="number"
              placeholder="e.g. 255"
              value={length}
              action={async (newValue) => {
                const newLength = newValue
                  ? String(Math.floor(Number(newValue)))
                  : "";
                setLength(newLength);
                await applyType("max", newLength);
              }}
            />
          )}
        </Label>
        <Label spacing="s" alignY="center">
          <Radio value="fixed" checked={mode === "fixed"} />
          Fixed length
          {mode === "fixed" && (
            <Input
              type="number"
              placeholder="e.g. 10"
              value={length}
              action={async (newValue) => {
                const newLength = newValue
                  ? String(Math.floor(Number(newValue)))
                  : "";
                setLength(newLength);
                await applyType("fixed", newLength);
              }}
            />
          )}
        </Label>
      </RadioList>
      <FieldDescription>
        Free text: unlimited. Max length: varchar(n), saves space up to limit.
        Fixed length: char(n), always pads to exact length.
      </FieldDescription>
    </Box>
  );
};

const NUMBER_TYPES = [
  "smallint",
  "integer",
  "bigint",
  "serial",
  "bigserial",
  "numeric",
  "real",
  "double precision",
  "money",
];

const NumberTypeOptions = ({ column, putColumn }) => {
  const currentType = NUMBER_TYPES.includes(column.data_type)
    ? column.data_type
    : "integer";
  const isExact = currentType === "numeric" || currentType === "decimal";

  return (
    <Box flex="y" spacing="s">
      <RadioList
        name="number_type"
        flex="y"
        spacing="xs"
        action={(type) => putColumn("data_type", type)}
      >
        <Label spacing="s" alignY="center">
          <Radio value="smallint" checked={currentType === "smallint"} />
          smallint — 2 bytes (up to 32,767)
        </Label>
        <Label spacing="s" alignY="center">
          <Radio value="integer" checked={currentType === "integer"} />
          integer — 4 bytes (up to 2 billion)
        </Label>
        <Label spacing="s" alignY="center">
          <Radio value="bigint" checked={currentType === "bigint"} />
          bigint — 8 bytes (very large numbers)
        </Label>
        <Label spacing="s" alignY="center">
          <Radio value="serial" checked={currentType === "serial"} />
          serial — auto-increment integer
        </Label>
        <Label spacing="s" alignY="center">
          <Radio value="bigserial" checked={currentType === "bigserial"} />
          bigserial — auto-increment bigint
        </Label>
        <Label spacing="s" alignY="center">
          <Radio value="numeric" checked={currentType === "numeric"} />
          numeric — exact decimal (configurable precision)
        </Label>
        <Label spacing="s" alignY="center">
          <Radio value="real" checked={currentType === "real"} />
          real — 4-byte floating point
        </Label>
        <Label spacing="s" alignY="center">
          <Radio
            value="double precision"
            checked={currentType === "double precision"}
          />
          double precision — 8-byte floating point
        </Label>
        <Label spacing="s" alignY="center">
          <Radio value="money" checked={currentType === "money"} />
          money — currency (2 decimal places)
        </Label>
      </RadioList>
      {isExact && (
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
      )}
    </Box>
  );
};

const DATETIME_BASES = ["date", "time", "timestamp", "interval"];

// Date & Time: radio list for base type + timezone toggle
const DateTimeTypeOptions = ({ column, putColumn }) => {
  const currentBase = getDateTimeBase(column.data_type);
  const [base, setBase] = useState(
    DATETIME_BASES.includes(currentBase) ? currentBase : "timestamp",
  );
  const [timezone, setTimezone] = useState(
    column.data_type.includes("with time zone"),
  );

  const applyType = async (newBase, newTimezone) => {
    let type = newBase;
    if (newTimezone && (newBase === "time" || newBase === "timestamp")) {
      type = `${newBase} with time zone`;
    }
    await putColumn("data_type", type);
  };

  return (
    <Box flex="y" spacing="s">
      <RadioList
        name="datetime_type"
        flex="y"
        spacing="xs"
        action={async (newBase) => {
          setBase(newBase);
          await applyType(newBase, timezone);
        }}
      >
        <Label spacing="s" alignY="center">
          <Radio value="date" checked={base === "date"} />
          date — calendar date (no time)
        </Label>
        <Label spacing="s" alignY="center">
          <Radio value="time" checked={base === "time"} />
          time — time of day (no date)
        </Label>
        <Label spacing="s" alignY="center">
          <Radio value="timestamp" checked={base === "timestamp"} />
          timestamp — date and time
        </Label>
        <Label spacing="s" alignY="center">
          <Radio value="interval" checked={base === "interval"} />
          interval — duration / time span
        </Label>
      </RadioList>
      {(base === "time" || base === "timestamp") && (
        <Box flex="y" spacing="xs">
          <Box spacing="s" alignY="center">
            <FieldLabel>With timezone</FieldLabel>
            <Checkbox
              appearance="toggle"
              checked={timezone}
              action={async (newChecked) => {
                setTimezone(newChecked);
                await applyType(base, newChecked);
              }}
            />
          </Box>
          <FieldDescription>
            When on, stores the timezone offset. Recommended for user-facing
            timestamps.
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

// Network: inet | cidr | macaddr
const NetworkTypeOptions = ({ column, putColumn }) => {
  const networkTypes = ["inet", "cidr", "macaddr"];
  const currentType = networkTypes.includes(column.data_type)
    ? column.data_type
    : "inet";

  return (
    <RadioList
      name="network_type"
      flex="y"
      spacing="xs"
      action={(type) => putColumn("data_type", type)}
    >
      <Label spacing="s" alignY="center">
        <Radio value="inet" checked={currentType === "inet"} />
        inet — IPv4 or IPv6 address
      </Label>
      <Label spacing="s" alignY="center">
        <Radio value="cidr" checked={currentType === "cidr"} />
        cidr — network address range
      </Label>
      <Label spacing="s" alignY="center">
        <Radio value="macaddr" checked={currentType === "macaddr"} />
        macaddr — MAC address
      </Label>
    </RadioList>
  );
};

// Other: uuid | xml | ARRAY
const OtherTypeOptions = ({ column, putColumn }) => {
  const otherTypes = ["uuid", "xml", "ARRAY"];
  const currentType = otherTypes.includes(column.data_type)
    ? column.data_type
    : "uuid";

  return (
    <RadioList
      name="other_type"
      flex="y"
      spacing="xs"
      action={(type) => putColumn("data_type", type)}
    >
      <Label spacing="s" alignY="center">
        <Radio value="uuid" checked={currentType === "uuid"} />
        uuid — universally unique identifier
      </Label>
      <Label spacing="s" alignY="center">
        <Radio value="xml" checked={currentType === "xml"} />
        xml — XML document
      </Label>
      <Label spacing="s" alignY="center">
        <Radio value="ARRAY" checked={currentType === "ARRAY"} />
        ARRAY — typed array
      </Label>
    </RadioList>
  );
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

// ─── Generated field ──────────────────────────────────────────────────────────

const GeneratedField = ({ column, isGenerated, putColumn }) => {
  const [showForm, setShowForm] = useState(false);
  const [expression, setExpression] = useState(
    column.generation_expression ?? "",
  );

  if (isGenerated) {
    return (
      <Box flex="y" spacing="xs">
        <FieldLabel>Generated expression</FieldLabel>
        <textarea
          rows={3}
          value={expression}
          style={{ resize: "vertical", fontFamily: "monospace" }}
          onInput={(e) => setExpression(e.currentTarget.value)}
        />
        <Button
          data-confirm-message={`Changing the generation expression will drop and re-create the column "${column.column_name}", permanently deleting its data. Continue?`}
          action={async () => {
            const expr = expression.trim();
            if (expr && expr !== column.generation_expression) {
              await putColumn("generation_expression", expr);
            }
          }}
        >
          Update expression
        </Button>
        <FieldDescription>
          This column's value is computed by PostgreSQL. Updating the expression
          will drop and re-create the column.
        </FieldDescription>
      </Box>
    );
  }

  if (showForm) {
    return (
      <Box flex="y" spacing="xs">
        <FieldLabel>Generated expression</FieldLabel>
        <textarea
          rows={3}
          placeholder="e.g. first_name || ' ' || last_name"
          value={expression}
          style={{ resize: "vertical", fontFamily: "monospace" }}
          onInput={(e) => setExpression(e.currentTarget.value)}
        />
        <Box spacing="s">
          <Button
            data-confirm-message={`Making "${column.column_name}" a generated column will drop and re-create it, permanently deleting its data. Continue?`}
            action={async () => {
              const expr = expression.trim();
              if (expr) {
                await putColumn("generation_expression", expr);
              }
            }}
          >
            Make generated column
          </Button>
          <Button
            action={() => {
              setShowForm(false);
              setExpression("");
            }}
          >
            Cancel
          </Button>
        </Box>
        <FieldDescription>
          The column value will be computed from this expression. This is
          destructive — existing data will be lost.
        </FieldDescription>
      </Box>
    );
  }

  return (
    <Box flex="y" spacing="xs">
      <Button action={() => setShowForm(true)}>
        Turn into generated column
      </Button>
      <FieldDescription>
        Turn this column into a computed column driven by a SQL expression.
      </FieldDescription>
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
