import { getTableColumns } from "./manage_sql.js";

export const createTable = async (sql, tablename) => {
  await sql`
    CREATE TABLE ${sql(tablename)} (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
};

export const selectTable = async (sql, tablename) => {
  const [table] = await sql`
    SELECT
      pg_tables.*,
      role.rolname AS owner_rolname,
      role.oid AS owner_oid,
      pg_class.oid AS tableoid
    FROM
      pg_tables
      LEFT JOIN pg_roles role ON pg_tables.tableowner = role.rolname
      LEFT JOIN pg_class ON pg_class.relname = pg_tables.tablename
      AND pg_class.relnamespace = (
        SELECT
          oid
        FROM
          pg_namespace
        WHERE
          nspname = pg_tables.schemaname
      )
    WHERE
      pg_tables.tablename = ${tablename}
  `;
  if (!table) {
    return [null, {}];
  }

  const pgTableColumns = await getTableColumns(sql, "pg_tables");
  const ownerRole = table.owner_oid
    ? {
        oid: table.owner_oid,
        rolname: table.owner_rolname,
      }
    : null;
  delete table.owner_rolname;
  delete table.owner_oid;

  // also return columns metadata (name, type, nullable, defaults, etc.)
  // find the table schema to avoid ambiguity when same name exists in multiple schemas
  const [tableInfo] = await sql`
    SELECT
      schemaname
    FROM
      pg_tables
    WHERE
      tablename = ${tablename}
    LIMIT
      1
  `;
  const columns = await getTableColumns(
    sql,
    tablename,
    tableInfo && tableInfo.schemaname
      ? { schema: tableInfo.schemaname }
      : undefined,
  );

  const [{ count: rowCount }] = await sql`
    SELECT
      COUNT(*) AS count
    FROM
      ${sql(tablename)}
  `;

  return [
    table,
    {
      columns,
      ownerRole,
      pgTableColumns,
      rowCount: Number(rowCount),
    },
  ];
};

export const selectTables = async (sql, { publicFilter, rolname }) => {
  let whereConditions = [];
  if (publicFilter) {
    whereConditions.push(sql`pg_tables.schemaname = 'public'`);
  } else {
    whereConditions.push(sql`
      pg_tables.schemaname NOT IN ('pg_catalog', 'information_schema')
    `);
  }
  if (rolname) {
    whereConditions.push(sql`pg_tables.tableowner = ${rolname}`);
  }

  const data = await sql`
    SELECT
      pg_tables.*,
      pg_class.oid AS tableoid
    FROM
      pg_tables
      LEFT JOIN pg_class ON pg_class.relname = pg_tables.tablename
      AND pg_class.relnamespace = (
        SELECT
          oid
        FROM
          pg_namespace
        WHERE
          nspname = pg_tables.schemaname
      )
    WHERE
      ${whereConditions.flatMap((x, i) => (i ? [sql`AND`, x] : x))}
    ORDER BY
      pg_class.oid ASC
  `;
  return data;
};

export const selectManyRows = async (sql, tablename) => {
  const columnsMeta = await getTableColumns(sql, tablename);
  const orderBy = resolveOrderBy(columnsMeta);
  const rows = await sql`
    SELECT
      *
    FROM
      ${sql(tablename)}
    ORDER BY
      ${sql.unsafe(orderBy)}
    LIMIT
      1000
  `;
  return rows;
};

// Determine the best column(s) to order rows by creation time.
// The goal is stable ordering that reflects when each row was first inserted,
// so that updating a row does not move it to the end of the table.
//
// Priority:
// 1. "created_at" column — explicit, reliable, type-agnostic
// 2. "id" that is a serial (integer + nextval default) — assigned at insert, never changes
// 3. xmin + ctid fallback — xmin is the transaction ID of the insert and survives updates
//    (unlike ctid which changes on every UPDATE due to PostgreSQL's MVCC). ctid breaks
//    ties between rows inserted in the same transaction.
const resolveOrderBy = (columnsMeta) => {
  const hasCreatedAt = columnsMeta.some((c) => c.column_name === "created_at");
  if (hasCreatedAt) {
    return "created_at";
  }
  const idCol = columnsMeta.find((c) => c.column_name === "id");
  const idIsSerial =
    idCol &&
    ["integer", "bigint", "smallint"].includes(idCol.data_type) &&
    idCol.column_default &&
    idCol.column_default.startsWith("nextval(");
  if (idIsSerial) {
    return "id";
  }
  return "xmin::text::bigint, ctid";
};
export const selectRow = async (sql, tablename, id) => {
  const row = await sql`
    SELECT
      *
    FROM
      ${sql(tablename)}
    WHERE
      id = ${id}
  `;
  return row[0];
};
export const insertRow = async (sql, tablename, values) => {
  const columnNames = Object.keys(values);
  // Determine table schema to query precise column metadata (always fetch before inserting)
  const [tableInfo] = await sql`
    SELECT
      schemaname
    FROM
      pg_tables
    WHERE
      tablename = ${tablename}
    LIMIT
      1
  `;
  const schema = tableInfo && tableInfo.schemaname;
  const columnsMeta = await getTableColumns(
    sql,
    tablename,
    schema ? { schema } : undefined,
  );
  const provided = new Set(columnNames);
  const finalColumns = [...columnNames];
  const finalValues = [...columnNames.map((cn) => values[cn])];
  for (const col of columnsMeta) {
    // skip if already provided
    if (provided.has(col.column_name)) {
      continue;
    }
    // respect generated/identity columns and defaults
    const hasDefault = col.column_default !== null;
    const isNullable = String(col.is_nullable).toUpperCase() === "YES";
    const isIdentity =
      ("is_identity" in col &&
        String(col.is_identity).toUpperCase() === "YES") ||
      false;
    const isGeneratedAlways =
      ("is_generated" in col &&
        String(col.is_generated).toUpperCase() === "ALWAYS") ||
      false;
    if (isIdentity || isGeneratedAlways) {
      continue; // let DB handle it
    }
    if (hasDefault) {
      // let DB apply the default by omitting the column
      continue;
    }
    if (isNullable) {
      // leave it out entirely to allow NULL/DEFAULT to apply
      continue;
    }
    // required without default: synthesize a value
    finalColumns.push(col.column_name);
    finalValues.push(generateValueForColumn(col));
  }

  if (finalColumns.length === 0) {
    // nothing to insert? fall back again to DEFAULT VALUES
    const insertDefault = await sql`
      INSERT INTO
        ${sql(tablename)}
      DEFAULT VALUES
      RETURNING
        *
    `;
    const [insertedRow] = insertDefault;
    return insertedRow;
  }

  const [insertedRow] = await sql`
    INSERT INTO
      ${sql(tablename)} (${sql(finalColumns)})
    VALUES
      (${finalValues})
    RETURNING
      *
  `;
  return insertedRow;
};
// helper to generate a reasonable value for a required column
const generateValueForColumn = (col) => {
  const type = (col.udt_name || col.data_type || "").toLowerCase();
  const maxLen = col.character_maximum_length;
  if (type === "uuid") {
    const rand =
      (globalThis.crypto && globalThis.crypto.randomUUID
        ? globalThis.crypto.randomUUID()
        : [4, 2, 2, 2, 6]
            .map((len) =>
              [...Array(len)]
                .map(() => Math.floor(Math.random() * 16).toString(16))
                .join(""),
            )
            .join("-")) || "00000000-0000-4000-8000-000000000000";
    return rand;
  }
  if (
    type.includes("int") ||
    type === "numeric" ||
    type === "decimal" ||
    type === "real" ||
    type === "double precision"
  ) {
    return 1;
  }
  if (type === "bool" || type === "boolean") {
    return false;
  }
  if (
    type === "timestamp" ||
    type === "timestamptz" ||
    type === "date" ||
    type === "time" ||
    type === "timetz"
  ) {
    return new Date().toISOString();
  }
  if (type === "json" || type === "jsonb") {
    return {};
  }
  // arrays or enums and other types fallback: simple string
  const base = "placeholder";
  if (maxLen && Number.isFinite(maxLen)) {
    return base.slice(0, maxLen);
  }
  return base;
};
export const addColumn = async (sql, tablename, columnProperties = {}) => {
  let {
    columnName,
    dataType = "TEXT",
    nullable = true,
    defaultValue,
  } = columnProperties;
  if (!columnName) {
    const existingColumns = await getTableColumns(sql, tablename);
    const existingNames = new Set(existingColumns.map((c) => c.column_name));
    let index = 1;
    columnName = `new_column_${index}`;
    while (existingNames.has(columnName)) {
      index++;
      columnName = `new_column_${index}`;
    }
  }
  const nullableClause = nullable ? sql`` : sql`NOT NULL`;
  const defaultClause =
    defaultValue !== undefined ? sql`DEFAULT ${defaultValue}` : sql``;
  await sql`
    ALTER TABLE ${sql(tablename)}
    ADD COLUMN ${sql(columnName)} ${sql.unsafe(
      dataType,
    )} ${nullableClause} ${defaultClause}
  `;
  const column = await getTableColumn(sql, tablename, columnName);
  return column;
};
const getTableColumn = async (sql, tablename, columnName) => {
  const [column] = await sql`
    SELECT
      *
    FROM
      information_schema.columns
    WHERE
      table_name = ${tablename}
      AND column_name = ${columnName}
  `;
  return column;
};
// serial/bigserial are pseudo-types; ALTER COLUMN TYPE rejects them.
// Map them to their real underlying type.
const SERIAL_TYPE_MAP = {
  serial: "integer",
  bigserial: "bigint",
};

export const updateColumn = async (
  sql,
  tablename,
  column_name,
  columnProperties,
) => {
  const {
    column_name: newColumnName,
    data_type,
    nullable,
    default_value,
    generation_expression,
  } = columnProperties;

  if (generation_expression !== undefined) {
    // Changing the generation expression requires DROP + ADD COLUMN
    const currentColumn = await getTableColumn(sql, tablename, column_name);
    const columnType = currentColumn.data_type;
    await sql`
      ALTER TABLE ${sql(tablename)}
      DROP COLUMN ${sql(column_name)}
    `;
    await sql`
      ALTER TABLE ${sql(tablename)}
      ADD COLUMN ${sql(column_name)} ${sql.unsafe(
        columnType,
      )} GENERATED ALWAYS AS (${sql.unsafe(generation_expression)}) STORED
    `;
    return getTableColumn(sql, tablename, column_name);
  }

  const alterClauses = [];
  if (data_type !== undefined) {
    const resolvedDataType = SERIAL_TYPE_MAP[data_type] ?? data_type;
    alterClauses.push(sql`
      ALTER COLUMN ${sql(column_name)} TYPE ${sql.unsafe(resolvedDataType)}
    `);
  }
  const isNullableTrue =
    nullable === true || String(nullable).toUpperCase() === "YES";
  const isNullableFalse =
    nullable === false || String(nullable).toUpperCase() === "NO";
  if (isNullableTrue) {
    alterClauses.push(sql`
      ALTER COLUMN ${sql(column_name)}
      DROP NOT NULL
    `);
  } else if (isNullableFalse) {
    // Before enforcing NOT NULL, fill any existing NULLs with a sensible value
    const currentColumn = await getTableColumn(sql, tablename, column_name);
    if (currentColumn) {
      const fillValue = generateValueForColumn(currentColumn);
      await sql`
        UPDATE ${sql(tablename)}
        SET
          ${sql(column_name)} = ${fillValue}
        WHERE
          ${sql(column_name)} IS NULL
      `;
    }
    alterClauses.push(sql`
      ALTER COLUMN ${sql(column_name)}
      SET NOT NULL
    `);
  }
  if (default_value === null) {
    alterClauses.push(sql`
      ALTER COLUMN ${sql(column_name)}
      DROP DEFAULT
    `);
  } else if (default_value !== undefined) {
    alterClauses.push(sql`
      ALTER COLUMN ${sql(column_name)}
      SET DEFAULT ${default_value}
    `);
  }
  if (alterClauses.length > 0) {
    await sql`
      ALTER TABLE ${sql(tablename)} ${alterClauses.flatMap((clause, i) =>
        i ? [sql`,`, clause] : clause,
      )}
    `;
  }
  const resolvedColumnName = newColumnName ?? column_name;
  if (newColumnName !== undefined && newColumnName !== column_name) {
    // RENAME COLUMN cannot be combined with other ALTER COLUMN clauses
    await sql`
      ALTER TABLE ${sql(tablename)}
      RENAME COLUMN ${sql(column_name)} TO ${sql(newColumnName)}
    `;
  }
  return getTableColumn(sql, tablename, resolvedColumnName);
};
export const deleteColumn = async (sql, tablename, columnName) => {
  await sql`
    ALTER TABLE ${sql(tablename)}
    DROP COLUMN ${sql(columnName)}
  `;
};
export const deleteRow = async (sql, tablename, id) => {
  await sql`
    DELETE FROM ${sql(tablename)}
    WHERE
      id = ${id}
  `;
};
export const updateRow = async (sql, tablename, id, values) => {
  if (Object.keys(values).length === 0) {
    return selectRow(sql, tablename, id);
  }
  await sql`
    UPDATE ${sql(tablename)}
    SET
      ${sql(values)}
    WHERE
      id = ${id}
  `;
  const idAfterUpdate = values.id || id;
  return selectRow(sql, tablename, idAfterUpdate);
};
