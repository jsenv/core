export const selectCurrentInfo = async (sql) => {
  const currentRoleResult = await sql`
    SELECT
      current_user
  `;
  const currentRoleName = currentRoleResult[0].current_user;
  const [currentRole] = await sql`
    SELECT
      *
    FROM
      pg_roles
    WHERE
      rolname = ${currentRoleName}
  `;

  const [currentDatabase] = await sql`
    SELECT
      *
    FROM
      pg_database
    WHERE
      datname = current_database()
  `;

  return { currentRole, currentDatabase };
};

export const countRoles = async (sql) => {
  const [roleStats] = await sql`
    SELECT
      COUNT(*) AS total_roles,
      COUNT(
        CASE
          WHEN rolcanlogin = TRUE THEN 1
        END
      ) AS can_login_count,
      COUNT(
        CASE
          WHEN rolcanlogin = FALSE THEN 1
        END
      ) AS group_count,
      COUNT(
        CASE
          WHEN (
            table_owners.tableowner IS NOT NULL
            OR database_owners.database_owner IS NOT NULL
          ) THEN 1
        END
      ) AS with_ownership_count
    FROM
      pg_roles
      LEFT JOIN (
        SELECT DISTINCT
          tableowner
        FROM
          pg_tables
        WHERE
          schemaname NOT IN ('pg_catalog', 'information_schema')
      ) table_owners ON pg_roles.rolname = table_owners.tableowner
      LEFT JOIN (
        SELECT DISTINCT
          pg_roles.rolname AS database_owner
        FROM
          pg_database
          JOIN pg_roles ON pg_roles.oid = pg_database.datdba
      ) database_owners ON pg_roles.rolname = database_owners.database_owner
  `;
  const { total_roles, can_login_count, group_count, with_ownership_count } =
    roleStats;
  return {
    total: parseInt(total_roles),
    canLoginCount: parseInt(can_login_count),
    groupCount: parseInt(group_count),
    withOwnershipCount: parseInt(with_ownership_count),
  };
};

export const countRows = async (sql, tableName, { whereClause } = {}) => {
  if (tableName === "pg_tables") {
    const [tableCountResult] = await sql`
      SELECT
        COUNT(*)
      FROM
        pg_tables
      WHERE
        schemaname NOT IN ('pg_catalog', 'information_schema')
    `;
    return parseInt(tableCountResult.count);
  }

  const [countResult] = await sql`
    SELECT
      COUNT(*)
    FROM
      ${sql(tableName)} ${whereClause || sql``}
  `;
  return parseInt(countResult.count);
};

export const getTableColumns = async (sql, tableName, options = {}) => {
  const { schema } = options;
  const where = [];
  where.push(sql`table_name = ${tableName}`);
  if (schema) {
    where.push(sql`table_schema = ${schema}`);
  }
  const columns = await sql`
    SELECT
      *
    FROM
      information_schema.columns
    WHERE
      ${where.flatMap((x, i) => (i ? [sql`AND`, x] : x))}
    ORDER BY
      ordinal_position ASC
  `;
  return columns;
};
