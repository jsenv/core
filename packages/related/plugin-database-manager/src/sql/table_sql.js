import { getTableColumns } from "./manage_sql.js";

export const createTable = async (sql, tablename) => {
  await sql`CREATE TABLE ${sql(tablename)} (id SERIAL PRIMARY KEY)`;
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

  const columns = await getTableColumns(sql, "pg_tables");
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
  const schemaColumns = await getTableColumns(
    sql,
    tablename,
    tableInfo && tableInfo.schemaname
      ? { schema: tableInfo.schemaname }
      : undefined,
  );

  return [
    table,
    {
      columns,
      schemaColumns,
      ownerRole,
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

export const alterTableQuery = async (sql, tablename, columnName, value) => {
  if (columnName === "tablename") {
    await sql`
      ALTER TABLE ${sql(tablename)}
      RENAME TO ${sql(value)}
    `;
    return;
  }

  // TODO: Handle other column alterations
  throw new Error(`Altering column "${columnName}" is not yet implemented`);
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
