import { Button } from "@jsenv/navi";

import { TABLE_COLUMN } from "./table_store.js";

// .selected_column_side_panel {
//   display: flex;
//   padding: 20px;
//   flex-direction: column;
//   gap: 24px;
// }

// .selected_column_header {
//   display: flex;
//   padding-bottom: 16px;
//   flex-direction: column;
//   gap: 4px;
//   border-bottom: 1px solid #e9ecef;
// }

// .selected_column_title {
//   color: #212529;
//   font-weight: 600;
//   font-size: 16px;
// }

// .selected_column_subtitle {
//   color: #6c757d;
//   font-size: 12px;
// }

// .selected_column_fields {
//   display: flex;
//   flex-direction: column;
//   gap: 12px;
// }

// .column_field {
//   display: flex;
//   flex-direction: column;
//   gap: 4px;
// }

// .column_field_label {
//   color: #6c757d;
//   font-weight: 600;
//   font-size: 11px;
//   text-transform: uppercase;
//   letter-spacing: 0.05em;
// }

// .column_field_description {
//   color: #868e96;
//   font-style: italic;
//   font-size: 11px;
//   line-height: 1.4;
// }

// .column_field_value select {
//   box-sizing: border-box;
//   width: 100%;
//   padding: 6px 8px;
//   color: #212529;
//   font-size: 13px;
//   background: white;
//   border: 1px solid #dee2e6;
//   border-radius: 4px;
//   cursor: pointer;

//   &:focus {
//     border-color: #0d6efd;
//     outline: none;
//     box-shadow: 0 0 0 2px rgba(13, 110, 253, 0.15);
//   }
// }

// .column_field_value input {
//   box-sizing: border-box;
//   width: 100%;
//   padding: 6px 8px;
//   color: #212529;
//   font-size: 13px;
//   background: white;
//   border: 1px solid #dee2e6;
//   border-radius: 4px;

//   &[readonly] {
//     color: #495057;
//     background: #f8f9fa;
//     cursor: default;
//   }

//   &[type="checkbox"] {
//     width: auto;
//     cursor: default;
//   }

//   &:not([readonly]):focus {
//     border-color: #0d6efd;
//     outline: none;
//     box-shadow: 0 0 0 2px rgba(13, 110, 253, 0.15);
//   }
// }

// .selected_column_actions {
//   padding-top: 16px;
//   border-top: 1px solid #e9ecef;
// }

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
    <div className="selected_column_side_panel">
      <div className="selected_column_header">
        <span className="selected_column_title">Column details</span>
        <span className="selected_column_subtitle">{column.column_name}</span>
      </div>

      <div className="selected_column_fields">
        <ColumnField label="Name">
          <input
            type="text"
            defaultValue={column.column_name}
            onBlur={async (e) => {
              const newName = e.currentTarget.value.trim();
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
            <input type="text" readOnly value={column.udt_name} />
          </ColumnField>
        )}

        <ColumnField
          label="Nullable"
          description="When checked, this column accepts NULL values. When unchecked, every row must have a value."
        >
          <input type="checkbox" readOnly checked={isNullable} />
        </ColumnField>

        {column.column_default !== null &&
          column.column_default !== undefined && (
            <ColumnField label="Default">
              <input type="text" readOnly value={column.column_default} />
            </ColumnField>
          )}

        {column.character_maximum_length !== null &&
          column.character_maximum_length !== undefined && (
            <ColumnField label="Max length">
              <input
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
              <input type="number" readOnly value={column.numeric_precision} />
            </ColumnField>
          )}

        {column.numeric_scale !== null &&
          column.numeric_scale !== undefined &&
          column.numeric_precision_radix === 10 && (
            <ColumnField label="Scale">
              <input type="number" readOnly value={column.numeric_scale} />
            </ColumnField>
          )}

        {column.datetime_precision !== null &&
          column.datetime_precision !== undefined && (
            <ColumnField label="Datetime precision">
              <input type="number" readOnly value={column.datetime_precision} />
            </ColumnField>
          )}

        {column.interval_type !== null &&
          column.interval_type !== undefined && (
            <ColumnField label="Interval type">
              <input type="text" readOnly value={column.interval_type} />
            </ColumnField>
          )}

        <ColumnField
          label="Identity"
          description="An identity column is auto-incremented by PostgreSQL. You cannot insert a value manually — the database generates it (like SERIAL but SQL-standard)."
        >
          <input type="checkbox" readOnly checked={isIdentity} />
        </ColumnField>

        {isIdentity && column.identity_generation && (
          <ColumnField
            label="Identity generation"
            description="ALWAYS: PostgreSQL always generates the value, inserts are rejected. BY DEFAULT: PostgreSQL generates it but you can still provide an explicit value."
          >
            <input type="text" readOnly value={column.identity_generation} />
          </ColumnField>
        )}

        <ColumnField
          label="Generated"
          description="A generated column is computed from other columns using an expression. Its value is calculated automatically and cannot be set manually."
        >
          <input type="checkbox" readOnly checked={isGenerated} />
        </ColumnField>

        {isGenerated && column.generation_expression && (
          <ColumnField label="Generation expression">
            <input type="text" readOnly value={column.generation_expression} />
          </ColumnField>
        )}

        <ColumnField
          label="Updatable"
          description="When unchecked, this column cannot be modified after the row is created (e.g. columns in non-updatable views, or identity ALWAYS columns)."
        >
          <input type="checkbox" readOnly checked={isUpdatable} />
        </ColumnField>
      </div>

      <div className="selected_column_actions">
        <Button
          data-confirm-message={`Are you sure you want to delete the column "${column.column_name}"? This will permanently remove the column and all its data.`}
          action={async () => {
            await deleteColumn();
            onClose();
          }}
        >
          Delete column
        </Button>
      </div>
    </div>
  );
};

const ColumnField = ({ label, description, children }) => (
  <div className="column_field">
    <label className="column_field_label">{label}</label>
    <div className="column_field_value">{children}</div>
    {description && (
      <span className="column_field_description">{description}</span>
    )}
  </div>
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
