export const createTable = async (sql, tablename) => {
  await sql`CREATE TABLE ${sql(tablename)} (id SERIAL PRIMARY KEY)`;
};

export const selectTable = async (sql, tablename) => {
  const [table] = await sql`
    SELECT
      *
    FROM
      pg_tables
    WHERE
      tablename = ${tablename}
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
  `;
  return data;
};

export const alterTableQuery = () => {};
