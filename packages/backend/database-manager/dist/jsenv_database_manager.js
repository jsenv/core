import { createFileSystemFetch } from "@jsenv/server";
import { readFileSync } from "node:fs";
import { connectAs } from "@jsenv/database";
import { execSync } from "node:child_process";

const databaseManagerHtmlFileUrl = import.meta
  .resolve("./client/database_manager.html");
const assetDirectoryUrl = import.meta.resolve("./client/assets/");

const serverPluginDatabaseManagerSpa = ({
  pathname,
  sourceDirectoryUrl,
}) => {
  // ensure no trailing slash
  pathname = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return {
    name: "jsenv:database_manager_spa",
    routes: [
      {
        endpoint: `GET ${pathname}/assets/*`,
        description: "Serve static files for database manager Web interface",
        declarationSource: import.meta.url,
        fetch: createFileSystemFetch(assetDirectoryUrl),
      },

      {
        endpoint: `GET ${pathname}/`,
        description: "Manage database using a Web interface",
        declarationSource: import.meta.url,
        fetch: (request) => {
          const apiServerUrl = new URL(`${pathname}/api`, request.origin).href;
          const htmlManagerRaw = readFileSync(
            new URL(databaseManagerHtmlFileUrl),
            "utf8",
          );
          const htmlManagerModified = replacePlaceholdersInHtml(
            htmlManagerRaw,
            {
              __DB_MANAGER_CONFIG__: {
                pathname,
                apiUrl: apiServerUrl,
              },
              ...(sourceDirectoryUrl
                ? {
                    "./assets/database_manager.jsx": () => {
                      const sourceDir = sourceDirectoryUrl.endsWith("/")
                        ? sourceDirectoryUrl
                        : `${sourceDirectoryUrl}/`;
                      return `/${assetDirectoryUrl.slice(sourceDir.length)}database_manager.jsx`;
                    },
                  }
                : {}),
            },
          );
          return new Response(htmlManagerModified, {
            headers: { "content-type": "text/html" },
          });
        },
      },
    ],
  };
};

const replacePlaceholdersInHtml = (html, replacers) => {
  for (const [name, replacer] of Object.entries(replacers)) {
    const value = typeof replacer === "function" ? replacer() : replacer;
    const replacement =
      typeof value === "string" ? value : JSON.stringify(value);
    html = html.replaceAll(name, replacement);
  }
  return html;
};

// https://www.postgresql.org/docs/14/sql-alterdatabase.html

const alterDatabaseQuery = async (sql, datname, colname, value) => {
  if (colname === "datdba") {
    await sql`ALTER DATABASE ${sql(datname)} OWNER TO ${sql(value)}`;
  }
};

const selectCurrentInfo = async (sql) => {
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

const countRoles = async (sql) => {
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

const countRows = async (sql, tableName, { whereClause } = {}) => {
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

const getTableColumns = async (sql, tableName, options = {}) => {
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

const selectRoleByName = async (sql, rolname) => {
  const results = await sql`
    SELECT
      *
    FROM
      pg_roles
    WHERE
      rolname = ${rolname}
  `;
  if (results.length === 0) {
    return null;
  }

  const columns = await getTableColumns(sql, "pg_roles");
  const role = results[0];
  //  const privileges = await sql`
  //     SELECT
  //       grantor,
  //       table_schema,
  //       table_name,
  //       privilege_type
  //     FROM
  //       information_schema.table_privileges
  //     WHERE
  //       grantee = ${rolname}
  //   `;
  const objects = await sql`
    SELECT
      pg_class.relname AS object_name,
      pg_class.relkind AS object_type,
      pg_namespace.nspname AS schema_name
    FROM
      pg_class
      JOIN pg_roles ON pg_roles.oid = pg_class.relowner
      LEFT JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
    WHERE
      pg_roles.rolname = ${rolname}
      AND pg_class.relkind IN ('r', 'v', 'm', 'S', 'f')
    ORDER BY
      pg_namespace.nspname,
      pg_class.relname
  `;
  const databases = await sql`
    SELECT
      pg_database.*
    FROM
      pg_database
      JOIN pg_roles ON pg_roles.oid = pg_database.datdba
    WHERE
      pg_roles.rolname = ${rolname}
  `;

  const members = await sql`
    SELECT
      member_role.*,
      grantor_role.rolname AS grantor_rolname,
      pg_auth_members.admin_option
    FROM
      pg_auth_members
      JOIN pg_roles AS parent_role ON pg_auth_members.roleid = parent_role.oid
      JOIN pg_roles AS member_role ON pg_auth_members.member = member_role.oid
      LEFT JOIN pg_roles AS grantor_role ON pg_auth_members.grantor = grantor_role.oid
    WHERE
      parent_role.rolname = ${rolname}
  `;

  return { role, objects, databases, members, columns };
};

const alterRoleQuery = async (sql, rolname, columnName, value) => {
  if (columnName === "rolname") {
    if (rolname === value) {
      return null;
    }
    return sql`
      ALTER ROLE ${sql(rolname)}
      RENAME TO ${sql(value)}
    `;
  }
  const keywords = booleanOptionKeywords[columnName];
  if (keywords) {
    return sql`
      ALTER ROLE ${sql(rolname)} ${sql.unsafe(keywords[value ? 0 : 1])}
    `;
  }
  if (columnName === "rolvaliduntil") {
    return sql`ALTER ROLE ${sql(rolname)} VALID UNTIL '${sql.unsafe(value)}'`;
  }
  if (columnName === "rolconnlimit") {
    return sql`
      ALTER ROLE ${sql(rolname)} CONNECTION
      LIMIT
        ${sql.unsafe(value)}
    `;
  }
  if (columnName === "rolpassword") {
    if (value) {
      return sql`ALTER ROLE ${sql(rolname)} PASSWORD '${sql.unsafe(value)}' `;
    }
    return sql`ALTER ROLE ${sql(rolname)} PASSWORD NULL`;
  }
  return null;
};

const booleanOptionKeywords = {
  rolsuper: ["SUPERUSER", "NOSUPERUSER"],
  rolinherit: ["INHERIT", "NOINHERIT"],
  rolcreaterole: ["CREATEROLE", "NOCREATEROLE"],
  rolcreatedb: ["CREATEDB", "NOCREATEDB"],
  rolcanlogin: ["LOGIN", "NOLOGIN"],
  rolreplication: ["REPLICATION", "NOREPLICATION"],
  rolbypassrls: ["BYPASSRLS", "NOBYPASSRLS"],
};

const createTable = async (sql, tablename) => {
  await sql`
    CREATE TABLE ${sql(tablename)} (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
};

const selectTable = async (sql, tablename) => {
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

const selectTables = async (sql, { publicFilter, rolname }) => {
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

const selectManyRows = async (sql, tablename) => {
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
const selectRow = async (sql, tablename, id) => {
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
const insertRow = async (sql, tablename, values) => {
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
const addColumn = async (sql, tablename, columnProperties = {}) => {
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

const updateColumn = async (
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
const deleteColumn = async (sql, tablename, columnName) => {
  await sql`
    ALTER TABLE ${sql(tablename)}
    DROP COLUMN ${sql(columnName)}
  `;
};
const deleteRow = async (sql, tablename, id) => {
  await sql`
    DELETE FROM ${sql(tablename)}
    WHERE
      id = ${id}
  `;
};
const updateRow = async (sql, tablename, id, values) => {
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

/**
 * - nom des tables au singulier
 */


const DATABASE_REST_API_PATHNAME = "/.internal/database/api";

const serverPluginDatabaseRestApi = ({ pathname }) => {
  let defaultUsername;
  let sql;

  return {
    init: () => {
      defaultUsername = execSync("whoami").toString().trim();
      sql = connectAs({
        username: defaultUsername,
        password: "",
        database: "postgres",
      });
    },

    routes: [
      {
        endpoint: `GET ${DATABASE_REST_API_PATHNAME}/explorer`,
        description: "Get info about the database manager explorer.",
        declarationSource: import.meta.url,
        fetch: async () => {
          const { currentRole, currentDatabase } = await selectCurrentInfo(sql);
          const databaseCount = await countRows(sql, "pg_database");
          const tableCount = await countRows(sql, "pg_tables");
          const roleCounts = await countRoles(sql);
          return Response.json({
            data: {
              currentRole,
              currentDatabase,
              databaseCount,
              tableCount,
              roleCounts,
            },
          });
        },
      },
      ...createRESTRoutes(`${DATABASE_REST_API_PATHNAME}/tables`, {
        "GET": async (request) => {
          const publicFilter = request.searchParams.has("public");
          const tables = await selectTables(sql, { publicFilter });
          const columns = await getTableColumns(sql, "pg_tables");
          return {
            data: tables,
            meta: {
              columns,
            },
          };
        },
        "POST": async (request) => {
          const { tablename } = await request.json();
          await createTable(sql, tablename);
          const [table, tableMeta] = await selectTable(sql, tablename);
          return {
            data: table,
            meta: {
              ...tableMeta,
            },
          };
        },
        "GET /:tablename": async (request) => {
          const { tablename } = request.params;
          const [table, tableMeta] = await selectTable(sql, tablename);
          return {
            data: table,
            meta: {
              ...tableMeta,
            },
          };
        },
        "DELETE /:tablename": async (request) => {
          const { tablename } = request.params;
          await sql`DROP TABLE ${sql(tablename)}`;
          return {
            data: null,
            meta: {
              count: await countRows(sql, "pg_tables"),
            },
          };
        },
        "DELETE": async (request) => {
          const tablenames = await request.json();
          if (!Array.isArray(tablenames)) {
            throw new Error("expected an array of tablenames");
          }
          if (tablenames.length === 0) {
            throw new Error("No tablename provided to deletes");
          }
          await sql.begin(async (sql) => {
            for (const tablename of tablenames) {
              await sql`DROP TABLE ${sql(tablename)}`;
            }
          });
          return {
            data: null,
            meta: {
              count: await countRows(sql, "pg_tables"),
            },
          };
        },
        "GET /:tablename/columns": async (request) => {
          const { tablename } = request.params;
          const columns = await getTableColumns(sql, tablename);
          return {
            data: columns,
          };
        },
        "POST /:tablename/columns": async (request) => {
          const { tablename } = request.params;
          const data = await request.json();
          const column = await addColumn(sql, tablename, data);
          return {
            data: column,
          };
        },
        "DELETE /:tablename/columns/:column_name": async (request) => {
          const { tablename, column_name } = request.params;
          await deleteColumn(sql, tablename, column_name);
          return null;
        },
        "PATCH /:tablename/columns/:column_name": async (request) => {
          const { tablename, column_name } = request.params;
          const columnProperties = await request.json();
          const column = await updateColumn(
            sql,
            tablename,
            column_name,
            columnProperties,
          );
          return {
            data: column,
          };
        },
        "PUT /:tablename/columns/:column_name/:column_property": async (
          request,
        ) => {
          const { tablename, column_name, column_property } = request.params;
          const value = await request.json();
          const column = await updateColumn(sql, tablename, column_name, {
            [column_property]: value,
          });
          return {
            data: column,
          };
        },
        "GET /:tablename/rows": async (request) => {
          const { tablename } = request.params;
          const rows = await selectManyRows(sql, tablename);
          return {
            data: rows,
          };
        },
        "POST /:tablename/rows": async (request) => {
          const { tablename } = request.params;
          const rowData = await request.json();
          const insertedRow = await insertRow(sql, tablename, rowData);
          return {
            data: insertedRow,
          };
        },
        "PATCH /:tablename/rows/:rowId": async (request) => {
          const { tablename, rowId } = request.params;
          const properties = await request.json();
          const updatedRow = await updateRow(sql, tablename, rowId, properties);
          return {
            data: updatedRow,
          };
        },
        "DELETE /:tablename/rows/:rowId": async (request) => {
          const { tablename, rowId } = request.params;
          await deleteRow(sql, tablename, rowId);
          return {
            data: null,
          };
        },
      }),
      ...createRESTRoutes(`${DATABASE_REST_API_PATHNAME}/roles`, {
        "GET": async (request) => {
          const canLogin = request.searchParams.get("can_login");
          let whereClause = "";
          if (canLogin !== null) {
            const canLoginValue = canLogin.toLowerCase();
            if (
              canLoginValue === "" ||
              canLoginValue === "1" ||
              canLoginValue === "true"
            ) {
              whereClause = sql`
                WHERE
                  pg_roles.rolcanlogin = TRUE
              `;
            } else if (canLoginValue === "0" || canLoginValue === "false") {
              whereClause = sql`
                WHERE
                  pg_roles.rolcanlogin = FALSE
              `;
            }
          }

          const ownersFlag = request.searchParams.has("owners");
          const roles = await sql`
            SELECT
              pg_roles.*,
              COALESCE(table_count_result.table_count, 0) AS table_count,
              COALESCE(database_count_result.database_count, 0) AS database_count
            FROM
              pg_roles
              LEFT JOIN (
                SELECT
                  tableowner,
                  COUNT(*) AS table_count
                FROM
                  pg_tables
                WHERE
                  schemaname NOT IN ('pg_catalog', 'information_schema')
                GROUP BY
                  tableowner
              ) table_count_result ON pg_roles.rolname = table_count_result.tableowner
              LEFT JOIN (
                SELECT
                  pg_roles.rolname AS database_owner,
                  COUNT(*) AS database_count
                FROM
                  pg_database
                  JOIN pg_roles ON pg_roles.oid = pg_database.datdba
                GROUP BY
                  pg_roles.rolname
              ) database_count_result ON pg_roles.rolname = database_count_result.database_owner ${whereClause ||
              sql``}
            ORDER BY
              pg_roles.oid ASC
          `;
          // I prefer order by "pg_roles.oid" over "pg_roles.rolname"
          // because it gives an important information:
          // the role created first has the lowest oid and is likely more important to see
          // either because it's old so it's important or it's old so it should be deleted
          // it does not help to find role by name which would be nice
          // but it helps to see role creation order which matters a lot
          // especially considering it's a database manager human that uses this
          for (const role of roles) {
            role.table_count = parseInt(role.table_count) || 0;
            role.database_count = parseInt(role.database_count) || 0;
            role.object_count = role.table_count + role.database_count;
          }

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
          if (ownersFlag) {
            const owners = [];
            for (const role of roles) {
              if (role.object_count > 0) {
                owners.push(role);
              }
            }
            return {
              data: owners,
              meta: {
                currentRole,
              },
            };
          }
          return {
            data: roles,
            meta: {
              currentRole,
            },
          };
        },
        "GET /:rolname": async (request) => {
          const { rolname } = request.params;
          const result = await selectRoleByName(sql, rolname);
          if (!result) {
            return null;
          }
          const { role, ...meta } = result;
          return {
            data: role,
            meta,
          };
        },
        "POST": async (request) => {
          const { rolname, rolcanlogin } = await request.json();
          // https://www.postgresql.org/docs/current/sql-createrole.html
          if (rolcanlogin) {
            await sql`CREATE ROLE ${sql(rolname)} LOGIN`;
          } else {
            await sql`CREATE ROLE ${sql(rolname)}`;
          }
          const [role] = await sql`
            SELECT
              *
            FROM
              pg_roles
            WHERE
              rolname = ${rolname}
          `;
          return {
            data: role,
            meta: {
              roleCounts: await countRoles(sql),
            },
          };
        },
        // when dropping roles, consider this: https://neon.tech/postgresql/postgresql-administration/postgresql-drop-role
        "DELETE /:rolname": async (request) => {
          const { rolname } = request.params;
          await sql`DROP ROLE ${sql(rolname)}`;
          return {
            data: null,
            meta: {
              roleCounts: await countRoles(sql),
            },
          };
        },
        "PUT /:rolname/:colname": async (request) => {
          const { rolname, colname } = request.params;
          const value = await request.json();
          await alterRoleQuery(sql, rolname, colname, value);
          return { [colname]: value };
        },
        "GET /:rolname/members": async (request) => {
          const { rolname } = request.params;
          const members = await sql`
            SELECT
              member_role.*,
              grantor_role.rolname AS grantor_rolname,
              pg_auth_members.admin_option
            FROM
              pg_auth_members
              JOIN pg_roles AS parent_role ON pg_auth_members.roleid = parent_role.oid
              JOIN pg_roles AS member_role ON pg_auth_members.member = member_role.oid
              LEFT JOIN pg_roles AS grantor_role ON pg_auth_members.grantor = grantor_role.oid
            WHERE
              parent_role.rolname = ${rolname}
          `;
          return {
            data: members,
          };
        },
        "POST /:rolname/members/:memberRolname": async (request) => {
          const { rolname, memberRolname } = request.params;
          await sql`GRANT ${sql(rolname)} TO ${sql(memberRolname)}`;
          const [memberRole] = await sql`
            SELECT
              *
            FROM
              pg_roles
            WHERE
              rolname = ${memberRolname}
          `;
          return {
            data: memberRole,
          };
        },
        "DELETE /:rolname/members/:memberRolname": async (request) => {
          const { rolname, memberRolname } = request.params;
          await sql`
            REVOKE ${sql(rolname)}
            FROM
              ${sql(memberRolname)}
          `;
          return {
            data: null,
          };
        },
        "GET /:rolname/tables": async (request) => {
          const { rolname } = request.params;
          const tables = await selectTables(sql, { rolname });
          return {
            data: tables,
            meta: {},
          };
        },
        "GET /:rolname/databases": async (request) => {
          const { rolname } = request.params;
          const databases = await sql`
            SELECT
              pg_database.*
            FROM
              pg_database
              JOIN pg_roles ON pg_roles.oid = pg_database.datdba
            WHERE
              pg_roles.rolname = ${rolname}
          `;
          if (databases.length === 0) {
            return {
              data: [],
            };
          }
          return {
            data: databases,
            meta: {},
          };
        },
      }),
      ...createRESTRoutes(`${DATABASE_REST_API_PATHNAME}/databases`, {
        "GET": async () => {
          const [currentDatabaseResult] = await sql`
            SELECT
              current_database()
          `;
          const currentDatname = currentDatabaseResult.current_database;
          const [currentDatabase] = await sql`
            SELECT
              *
            FROM
              pg_database
            WHERE
              datname = ${currentDatname}
          `;
          const databases = await sql`
            SELECT
              *
            FROM
              pg_database
            ORDER BY
              pg_database.oid ASC
          `;

          const countTables = async (database) => {
            if (database === currentDatname) {
              return countRows(sql, "pg_tables");
            }
            const sqlConnectedToThatDb = connectAs({
              username: defaultUsername,
              password: "",
              database,
            });
            const count = await countRows(sqlConnectedToThatDb, "pg_tables");
            sqlConnectedToThatDb.end();
            return count;
          };
          const tableCounts = {};
          const promises = [];
          for (const database of databases) {
            if (!database.datallowconn) {
              continue;
            }
            const countPromise = countTables(database.datname);
            promises.push(countPromise);
            (async () => {
              const count = await countPromise;
              tableCounts[database.datname] = count;
            })();
          }
          await Promise.all(promises);

          return {
            data: databases,
            meta: {
              currentDatabase,
              tableCounts,
            },
          };
        },
        "GET /:datname": async (request) => {
          const { datname } = request.params;
          const results = await sql`
            SELECT
              pg_database.*,
              role.rolname AS owner_rolname,
              role.oid AS owner_oid
            FROM
              pg_database
              LEFT JOIN pg_roles role ON role.oid = pg_database.datdba
            WHERE
              pg_database.datname = ${datname}
          `;
          if (results.length === 0) {
            return null;
          }
          const columns = await getTableColumns(sql, "pg_database");
          const [database] = results;
          const ownerRole = database.owner_oid
            ? {
                oid: database.owner_oid,
                rolname: database.owner_rolname,
              }
            : null;
          delete database.owner_rolname;
          delete database.owner_oid;

          return {
            data: database,
            meta: {
              ownerRole,
              columns,
            },
          };
        },
        "POST": async (request) => {
          const { datname } = await request.json();
          await sql`CREATE DATABASE ${sql(datname)}`;
          const [database] = await sql`
            SELECT
              *
            FROM
              pg_database
            WHERE
              datname = ${datname}
          `;
          return {
            data: database,
            meta: {
              count: await countRows(sql, "pg_database"),
            },
          };
        },
        "DELETE /:datname": async (request) => {
          const { datname } = request.params;
          await sql`DROP DATABASE ${sql(datname)}`;
          return {
            data: null,
            meta: {
              count: await countRows(sql, "pg_database"),
            },
          };
        },
        "PUT /:datname/:colname": async (request) => {
          const { datname, colname } = request.params;
          const value = await request.json();
          await alterDatabaseQuery(sql, datname, colname, value);
          return { [colname]: value };
        },
      }),
      {
        endpoint: `PUT ${DATABASE_REST_API_PATHNAME}/tables/:tableName/columns/name`,
        declarationSource: import.meta.url,
        acceptedMediaTypes: ["application/json"],
        fetch: async (request) => {
          const tableName = request.params.tableName;
          const tableNewName = await request.json();
          await sql`
            ALTER TABLE ${sql(tableName)}
            RENAME TO ${sql(tableNewName)};
          `;
          return Response.json({ name: tableNewName });
        },
      },
      {
        endpoint: `PUT ${DATABASE_REST_API_PATHNAME}/tables/:tableName/columns/rowsecurity`,
        declarationSource: import.meta.url,
        acceptedMediaTypes: ["application/json"],
        fetch: async (request) => {
          const tableName = request.params.tableName;
          const value = await request.json();
          if (value === "on") {
            await sql`
              ALTER TABLE ${sql(tableName)} ENABLE ROW LEVEL SECURITY;
            `;
          } else {
            await sql`
              ALTER TABLE ${sql(tableName)} DISABLE ROW LEVEL SECURITY;
            `;
          }
          return Response.json({ rowsecurity: value === "on" });
        },
      },
      {
        endpoint: `PUT ${DATABASE_REST_API_PATHNAME}/tables/:tableName/columns/:columnName/rows/:rowId`,
        declarationSource: import.meta.url,
        acceptedMediaTypes: ["application/json"],
        fetch: async () => {
          // const tableName = request.params.tableName;
          // const columnName = request.params.columnName;
          // const rowId = request.params.rowId;
        },
      },
      // https://wiki.postgresql.org/wiki/Alter_column_position#Add_columns_and_move_data
      {
        endpoint: `PUT ${DATABASE_REST_API_PATHNAME}/tables/:name/columns/:columnName/move_before`,
        declarationSource: import.meta.url,
        acceptedMediaTypes: ["application/json"],
        fetch: async (request) => {
          const tableName = request.params.name;
          const columnName = request.params.columnName;
          const beforeColumnName = await request.json();
          if (columnName === beforeColumnName) {
            return Response.json(
              `Column and before column are the same :${columnName}`,
              { status: 400 },
            );
          }
          const columns = await sql`
            SELECT
              ordinal_position,
              data_type
            FROM
              information_schema.columns
            WHERE
              table_name = ${sql(tableName)}
              AND column_name = ${sql(columnName)}
          `;
          let columnIndex;
          let beforeColumnIndex;
          {
            let index;
            while (index < columns.length) {
              const columnCandidate = columns[index];
              if (columnCandidate.column_name === columnName) {
                columnIndex = index;
                if (beforeColumnIndex === undefined) {
                  continue;
                }
                break;
              }
              if (columnCandidate.column_name === beforeColumnName) {
                beforeColumnIndex = index;
                if (columnIndex === undefined) {
                  continue;
                }
                break;
              }
            }
          }
          if (columnIndex === undefined) {
            return Response.json(
              {
                message: `Column ${columnName} not found in table ${tableName}`,
              },
              { status: 404 },
            );
          }
          if (beforeColumnIndex === undefined) {
            return Response.json(
              {
                message: `Column ${beforeColumnName} not found in table ${tableName}`,
              },
              { status: 404 },
            );
          }
          if (beforeColumnIndex === columnIndex - 1) {
            return Response.json("", { status: 204 });
          }

          const addInstructions = [];
          const setInstructions = [];
          const removeInstructions = [];
          const renameInstructions = [];
          /**
           *  - a|b|c
           *  - I want to move b before a
           *  1. COPY a = a_temp and c=c_temp
           *  -> a|b|c|a_temp|c_temp
           *  3. REMOVE a and c
           *  -> b|a_temp|c_temp
           *  4. RENAME a_temp to a and c_temp to c
           *  -> b|a|c
           */
          {
            {
              let indexBefore = beforeColumnIndex;
              while (indexBefore--) {
                const columnBefore = columns[indexBefore];
                addInstructions.push(
                  `ADD COLUMN ${sql(columnBefore.column_name)}_temp ${sql(
                    columnBefore.data_type,
                  )}`,
                );
                setInstructions.push(
                  `${sql(columnBefore.column_name)}_temp = ${sql(
                    columnBefore.column_name,
                  )}`,
                );
                removeInstructions.push(
                  `DROP COLUMN ${sql(columnBefore.column_name)} cascade`,
                );
                renameInstructions.push(
                  `ALTER TABLE ${sql(tableName)} RENAME COLUMN ${sql(
                    columnBefore.column_name,
                  )}_temp TO ${sql(columnBefore.column_name)}`,
                );
              }
            }
            {
              let indexAfter = columnIndex + 1;
              while (indexAfter < columns.length) {
                const columnAfter = columns[indexAfter];
                addInstructions.push(
                  `ADD COLUMN ${sql(columnAfter.column_name)}_temp ${sql(
                    columnAfter.data_type,
                  )}`,
                );
                setInstructions.push(
                  `${sql(columnAfter.column_name)}_temp = ${sql(
                    columnAfter.column_name,
                  )}`,
                );
                removeInstructions.push(
                  `DROP COLUMN ${sql(columnAfter.column_name)} cascade`,
                );
                renameInstructions.push(
                  `ALTER TABLE ${sql(tableName)} RENAME COLUMN ${sql(
                    columnAfter.column_name,
                  )}_temp TO ${sql(columnAfter.column_name)}`,
                );
                indexAfter++;
              }
            }
          }

          let query = "";
          {
            query += "\n";
            query += `# add new columns`;
            query += "\n";
            query = `ALTER TABLE ${sql(tableName)} `;
            query += addInstructions.join(", ");
            query += `;`;
            {
              query += "\n";
              query += `# update new columns`;
              query += "\n";
              query += `ALTER TABLE ${sql(tableName)}`;
              query += ` SET`;
              query += setInstructions.join(", ");
              query += `;`;
            }
          }
          {
            query += "\n";
            query += `# remove old columns`;
            query += "\n";
            query += `ALTER TABLE ${sql(tableName)} `;
            query += removeInstructions.join(", ");
            query += `;`;
          }
          {
            query += "\n";
            query += `# rename new columns`;
            query += "\n";
            query += renameInstructions.join("\n");
            query += "\n";
          }
          // here we want to check how the query look like
          debugger;
          await sql.unsafe(query);
          return Response.json(null, { status: 204 });
        },
      },
      {
        endpoint: `GET ${DATABASE_REST_API_PATHNAME}`,
        description: "Get info about the database manager API.",
        declarationSource: import.meta.url,
        fetch: () => {
          return Response.json({
            data: {
              pathname,
              apiUrl: new URL(`${pathname}api`, import.meta.url).href,
            },
          });
        },
      },
      {
        endpoint: `GET ${DATABASE_REST_API_PATHNAME}/`,
        description: "Fallback for api endpoints (404).",
        declarationSource: import.meta.url,
        fetch: (request) => {
          return Response.json(
            { message: `API endpoint not found: ${request.url}` },
            { status: 404 },
          );
        },
      },
    ],
  };
};

const createRESTRoutes = (resource, endpoints) => {
  const routes = [];

  const onRoute = ({ method, subpath }, handler) => {
    const endpointResource = subpath ? `${resource}${subpath}` : resource;
    if (method === "GET") {
      const getRoute = {
        endpoint: `GET ${endpointResource}`,
        declarationSource: import.meta.url,
        fetch: async (request) => {
          const body = await handler(request);
          if (
            !body ||
            ("data" in body &&
              "meta" in body &&
              (body.data === null || body.data === undefined))
          ) {
            const paramKeys = Object.keys(request.params);
            if (paramKeys.length) {
              const identifier = request.params[paramKeys[0]];
              return Response.json(
                { message: `${endpointResource} "${identifier}" not found` },
                { status: 404 },
              );
            }
            return Response.json(
              { message: `${endpointResource} not found` },
              { status: 404 },
            );
          }
          return Response.json(body);
        },
      };
      routes.push(getRoute);
      return;
    }
    if (method === "POST") {
      const postRoute = {
        endpoint: `POST ${endpointResource}`,
        declarationSource: import.meta.url,
        acceptedMediaTypes: ["application/json"],
        fetch: async (request) => {
          const body = await handler(request);
          return Response.json(body, { status: 201 });
        },
      };
      routes.push(postRoute);
      return;
    }
    if (method === "PATCH") {
      const patchRoute = {
        endpoint: `PATCH ${endpointResource}`,
        declarationSource: import.meta.url,
        acceptedMediaTypes: ["application/json"],
        fetch: async (request) => {
          const body = await handler(request);
          return Response.json(body);
        },
      };
      routes.push(patchRoute);
      return;
    }
    if (method === "PUT") {
      const putRoute = {
        endpoint: `PUT ${endpointResource}`,
        declarationSource: import.meta.url,
        fetch: async (request) => {
          const body = await handler(request);
          return Response.json(body);
        },
      };
      routes.push(putRoute);
      return;
    }
    if (method === "DELETE") {
      const deleteRoute = {
        endpoint: `DELETE ${endpointResource}`,
        declarationSource: import.meta.url,
        fetch: async (request) => {
          const body = await handler(request);
          return body === null || body === undefined
            ? new Response(null, { status: 204 })
            : Response.json(body);
        },
      };
      routes.push(deleteRoute);
      return;
    }
  };

  for (const key of Object.keys(endpoints)) {
    if (key.includes(" ")) {
      const [method, subpath] = key.split(" ");
      onRoute({ method, subpath }, endpoints[key]);
    } else {
      onRoute({ method: key }, endpoints[key]);
    }
  }

  return routes;
};

const serverPluginDatabaseManager = ({
  pathname = "/.internal/database",
  sourceDirectoryUrl,
} = {}) => {
  return [
    serverPluginDatabaseRestApi({ pathname }),
    serverPluginDatabaseManagerSpa({ pathname, sourceDirectoryUrl }),
    serverPluginPostgresErrorHandler(),
    serverPluginJsonParseErrorHandler(),
  ];
};

const serverPluginPostgresErrorHandler = () => {
  return {
    name: "jsenv:postgres_error_handler",
    // postgress error handler
    handleError: (e) => {
      if (!e || e.name !== "PostgresError") {
        return null;
      }
      let message = e.message;
      if (e.detail) {
        message += ` (${e.detail})`;
      }
      const errorData = {
        ...e,
        message,
      };
      if (e.code === "2BP01" || e.code === "42710") {
        return Response.json(errorData, {
          status: 409,
          statusText: message.replace(/\n/g, ""),
        });
      }
      if (e.code === "42704") {
        return Response.json(errorData, {
          status: 404,
          statusText: message,
        });
      }
      return Response.json(errorData, {
        status: 500,
        statusText: message,
      });
    },
  };
};
const serverPluginJsonParseErrorHandler = () => {
  return {
    name: "uncaught_json_parse_error_handler",
    handleError: (e) => {
      // we assume the error originates from client here
      // but if some JSON.parse fails on the server application code unrelated to the client
      // we would also return 400 while it should be 500
      // ideally every JSON.parse related to the client should be catched
      if (
        e.name === "SyntaxError" &&
        e.message === "Unexpected end of JSON input"
      ) {
        return new Response(null, {
          status: 400,
          statusText: "Invalid JSON input",
        });
      }
      return null;
    },
  };
};

export { serverPluginDatabaseManager };
