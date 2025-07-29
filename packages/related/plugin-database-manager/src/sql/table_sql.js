export const createTable = async (sql, tablename) => {
  await sql`CREATE TABLE ${sql(tablename)} (id SERIAL PRIMARY KEY)`;
};

export const selectTable = async (sql, tablename) => {
  const [table] = await sql`
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
      pg_tables.tablename = ${tablename}
  `;
  return table;
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
