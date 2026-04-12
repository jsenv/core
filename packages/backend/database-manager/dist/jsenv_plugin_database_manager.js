import { connectAs } from "@jsenv/database";
import { ensurePathnameTrailingSlash, urlToExtension, urlIsOrIsInsideOf, asUrlWithoutSearch } from "@jsenv/urls";
import { execSync } from "node:child_process";

function _taggedTemplateLiteral (strings, raw) {
  if (!raw) {
    raw = strings.slice(0);
  }
  return Object.freeze(Object.defineProperties(strings, {
    raw: {
      value: Object.freeze(raw)
    }
  }));
}

var _templateObject$4;
// https://www.postgresql.org/docs/14/sql-alterdatabase.html

const alterDatabaseQuery = async (sql, datname, colname, value) => {
  if (colname === "datdba") {
    await sql(_templateObject$4 || (_templateObject$4 = _taggedTemplateLiteral(["ALTER DATABASE ", " OWNER TO ", ""])), sql(datname), sql(value));
  }
};

var _templateObject$3, _templateObject2$3, _templateObject3$3, _templateObject4$3, _templateObject5$3, _templateObject6$3, _templateObject7$3, _templateObject8$3, _templateObject9$3, _templateObject0$3, _templateObject1$2;
const selectCurrentInfo = async sql => {
  const currentRoleResult = await sql(_templateObject$3 || (_templateObject$3 = _taggedTemplateLiteral(["\n    SELECT\n      current_user\n  "])));
  const currentRoleName = currentRoleResult[0].current_user;
  const [currentRole] = await sql(_templateObject2$3 || (_templateObject2$3 = _taggedTemplateLiteral(["\n    SELECT\n      *\n    FROM\n      pg_roles\n    WHERE\n      rolname = ", "\n  "])), currentRoleName);
  const [currentDatabase] = await sql(_templateObject3$3 || (_templateObject3$3 = _taggedTemplateLiteral(["\n    SELECT\n      *\n    FROM\n      pg_database\n    WHERE\n      datname = current_database()\n  "])));
  return {
    currentRole,
    currentDatabase
  };
};
const countRoles = async sql => {
  const [roleStats] = await sql(_templateObject4$3 || (_templateObject4$3 = _taggedTemplateLiteral(["\n    SELECT\n      COUNT(*) AS total_roles,\n      COUNT(\n        CASE\n          WHEN rolcanlogin = TRUE THEN 1\n        END\n      ) AS can_login_count,\n      COUNT(\n        CASE\n          WHEN rolcanlogin = FALSE THEN 1\n        END\n      ) AS group_count,\n      COUNT(\n        CASE\n          WHEN (\n            table_owners.tableowner IS NOT NULL\n            OR database_owners.database_owner IS NOT NULL\n          ) THEN 1\n        END\n      ) AS with_ownership_count\n    FROM\n      pg_roles\n      LEFT JOIN (\n        SELECT DISTINCT\n          tableowner\n        FROM\n          pg_tables\n        WHERE\n          schemaname NOT IN ('pg_catalog', 'information_schema')\n      ) table_owners ON pg_roles.rolname = table_owners.tableowner\n      LEFT JOIN (\n        SELECT DISTINCT\n          pg_roles.rolname AS database_owner\n        FROM\n          pg_database\n          JOIN pg_roles ON pg_roles.oid = pg_database.datdba\n      ) database_owners ON pg_roles.rolname = database_owners.database_owner\n  "])));
  const {
    total_roles,
    can_login_count,
    group_count,
    with_ownership_count
  } = roleStats;
  return {
    total: parseInt(total_roles),
    canLoginCount: parseInt(can_login_count),
    groupCount: parseInt(group_count),
    withOwnershipCount: parseInt(with_ownership_count)
  };
};
const countRows = async (sql, tableName, {
  whereClause
} = {}) => {
  if (tableName === "pg_tables") {
    const [tableCountResult] = await sql(_templateObject5$3 || (_templateObject5$3 = _taggedTemplateLiteral(["\n      SELECT\n        COUNT(*)\n      FROM\n        pg_tables\n      WHERE\n        schemaname NOT IN ('pg_catalog', 'information_schema')\n    "])));
    return parseInt(tableCountResult.count);
  }
  const [countResult] = await sql(_templateObject6$3 || (_templateObject6$3 = _taggedTemplateLiteral(["\n    SELECT\n      COUNT(*)\n    FROM\n      ", " ", "\n  "])), sql(tableName), whereClause || sql(_templateObject7$3 || (_templateObject7$3 = _taggedTemplateLiteral([""]))));
  return parseInt(countResult.count);
};
const getTableColumns = async (sql, tableName, options = {}) => {
  const {
    schema
  } = options;
  const where = [];
  where.push(sql(_templateObject8$3 || (_templateObject8$3 = _taggedTemplateLiteral(["table_name = ", ""])), tableName));
  if (schema) {
    where.push(sql(_templateObject9$3 || (_templateObject9$3 = _taggedTemplateLiteral(["table_schema = ", ""])), schema));
  }
  const columns = await sql(_templateObject0$3 || (_templateObject0$3 = _taggedTemplateLiteral(["\n    SELECT\n      *\n    FROM\n      information_schema.columns\n    WHERE\n      ", "\n    ORDER BY\n      ordinal_position ASC\n  "])), where.flatMap((x, i) => i ? [sql(_templateObject1$2 || (_templateObject1$2 = _taggedTemplateLiteral(["AND"]))), x] : x));
  return columns;
};

var _templateObject$2, _templateObject2$2, _templateObject3$2, _templateObject4$2, _templateObject5$2, _templateObject6$2, _templateObject7$2, _templateObject8$2, _templateObject9$2, _templateObject0$2;
const selectRoleByName = async (sql, rolname) => {
  const results = await sql(_templateObject$2 || (_templateObject$2 = _taggedTemplateLiteral(["\n    SELECT\n      *\n    FROM\n      pg_roles\n    WHERE\n      rolname = ", "\n  "])), rolname);
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
  const objects = await sql(_templateObject2$2 || (_templateObject2$2 = _taggedTemplateLiteral(["\n    SELECT\n      pg_class.relname AS object_name,\n      pg_class.relkind AS object_type,\n      pg_namespace.nspname AS schema_name\n    FROM\n      pg_class\n      JOIN pg_roles ON pg_roles.oid = pg_class.relowner\n      LEFT JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid\n    WHERE\n      pg_roles.rolname = ", "\n      AND pg_class.relkind IN ('r', 'v', 'm', 'S', 'f')\n    ORDER BY\n      pg_namespace.nspname,\n      pg_class.relname\n  "])), rolname);
  const databases = await sql(_templateObject3$2 || (_templateObject3$2 = _taggedTemplateLiteral(["\n    SELECT\n      pg_database.*\n    FROM\n      pg_database\n      JOIN pg_roles ON pg_roles.oid = pg_database.datdba\n    WHERE\n      pg_roles.rolname = ", "\n  "])), rolname);
  const members = await sql(_templateObject4$2 || (_templateObject4$2 = _taggedTemplateLiteral(["\n    SELECT\n      member_role.*,\n      grantor_role.rolname AS grantor_rolname,\n      pg_auth_members.admin_option\n    FROM\n      pg_auth_members\n      JOIN pg_roles AS parent_role ON pg_auth_members.roleid = parent_role.oid\n      JOIN pg_roles AS member_role ON pg_auth_members.member = member_role.oid\n      LEFT JOIN pg_roles AS grantor_role ON pg_auth_members.grantor = grantor_role.oid\n    WHERE\n      parent_role.rolname = ", "\n  "])), rolname);
  return {
    role,
    objects,
    databases,
    members,
    columns
  };
};
const alterRoleQuery = async (sql, rolname, columnName, value) => {
  if (columnName === "rolname") {
    if (rolname === value) {
      return null;
    }
    return sql(_templateObject5$2 || (_templateObject5$2 = _taggedTemplateLiteral(["\n      ALTER ROLE ", "\n      RENAME TO ", "\n    "])), sql(rolname), sql(value));
  }
  const keywords = booleanOptionKeywords[columnName];
  if (keywords) {
    return sql(_templateObject6$2 || (_templateObject6$2 = _taggedTemplateLiteral(["\n      ALTER ROLE ", " ", "\n    "])), sql(rolname), sql.unsafe(keywords[value ? 0 : 1]));
  }
  if (columnName === "rolvaliduntil") {
    return sql(_templateObject7$2 || (_templateObject7$2 = _taggedTemplateLiteral(["ALTER ROLE ", " VALID UNTIL '", "'"])), sql(rolname), sql.unsafe(value));
  }
  if (columnName === "rolconnlimit") {
    return sql(_templateObject8$2 || (_templateObject8$2 = _taggedTemplateLiteral(["\n      ALTER ROLE ", " CONNECTION\n      LIMIT\n        ", "\n    "])), sql(rolname), sql.unsafe(value));
  }
  if (columnName === "rolpassword") {
    if (value) {
      return sql(_templateObject9$2 || (_templateObject9$2 = _taggedTemplateLiteral(["ALTER ROLE ", " PASSWORD '", "' "])), sql(rolname), sql.unsafe(value));
    }
    return sql(_templateObject0$2 || (_templateObject0$2 = _taggedTemplateLiteral(["ALTER ROLE ", " PASSWORD NULL"])), sql(rolname));
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
  rolbypassrls: ["BYPASSRLS", "NOBYPASSRLS"]
};

var _templateObject$1, _templateObject2$1, _templateObject3$1, _templateObject4$1, _templateObject5$1, _templateObject6$1, _templateObject7$1, _templateObject8$1, _templateObject9$1, _templateObject0$1, _templateObject1$1, _templateObject10$1, _templateObject11$1, _templateObject12$1, _templateObject13$1, _templateObject14$1, _templateObject15$1, _templateObject16$1, _templateObject17$1, _templateObject18$1, _templateObject19$1, _templateObject20$1, _templateObject21$1, _templateObject22$1, _templateObject23$1, _templateObject24$1, _templateObject25$1, _templateObject26$1, _templateObject27, _templateObject28, _templateObject29, _templateObject30, _templateObject31, _templateObject32;
const createTable = async (sql, tablename) => {
  await sql(_templateObject$1 || (_templateObject$1 = _taggedTemplateLiteral(["\n    CREATE TABLE ", " (\n      id SERIAL PRIMARY KEY,\n      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n    )\n  "])), sql(tablename));
};
const selectTable = async (sql, tablename) => {
  const [table] = await sql(_templateObject2$1 || (_templateObject2$1 = _taggedTemplateLiteral(["\n    SELECT\n      pg_tables.*,\n      role.rolname AS owner_rolname,\n      role.oid AS owner_oid,\n      pg_class.oid AS tableoid\n    FROM\n      pg_tables\n      LEFT JOIN pg_roles role ON pg_tables.tableowner = role.rolname\n      LEFT JOIN pg_class ON pg_class.relname = pg_tables.tablename\n      AND pg_class.relnamespace = (\n        SELECT\n          oid\n        FROM\n          pg_namespace\n        WHERE\n          nspname = pg_tables.schemaname\n      )\n    WHERE\n      pg_tables.tablename = ", "\n  "])), tablename);
  if (!table) {
    return [null, {}];
  }
  const pgTableColumns = await getTableColumns(sql, "pg_tables");
  const ownerRole = table.owner_oid ? {
    oid: table.owner_oid,
    rolname: table.owner_rolname
  } : null;
  delete table.owner_rolname;
  delete table.owner_oid;

  // also return columns metadata (name, type, nullable, defaults, etc.)
  // find the table schema to avoid ambiguity when same name exists in multiple schemas
  const [tableInfo] = await sql(_templateObject3$1 || (_templateObject3$1 = _taggedTemplateLiteral(["\n    SELECT\n      schemaname\n    FROM\n      pg_tables\n    WHERE\n      tablename = ", "\n    LIMIT\n      1\n  "])), tablename);
  const columns = await getTableColumns(sql, tablename, tableInfo && tableInfo.schemaname ? {
    schema: tableInfo.schemaname
  } : undefined);
  const [{
    count: rowCount
  }] = await sql(_templateObject4$1 || (_templateObject4$1 = _taggedTemplateLiteral(["\n    SELECT\n      COUNT(*) AS count\n    FROM\n      ", "\n  "])), sql(tablename));
  return [table, {
    columns,
    ownerRole,
    pgTableColumns,
    rowCount: Number(rowCount)
  }];
};
const selectTables = async (sql, {
  publicFilter,
  rolname
}) => {
  let whereConditions = [];
  if (publicFilter) {
    whereConditions.push(sql(_templateObject5$1 || (_templateObject5$1 = _taggedTemplateLiteral(["pg_tables.schemaname = 'public'"]))));
  } else {
    whereConditions.push(sql(_templateObject6$1 || (_templateObject6$1 = _taggedTemplateLiteral(["\n      pg_tables.schemaname NOT IN ('pg_catalog', 'information_schema')\n    "]))));
  }
  if (rolname) {
    whereConditions.push(sql(_templateObject7$1 || (_templateObject7$1 = _taggedTemplateLiteral(["pg_tables.tableowner = ", ""])), rolname));
  }
  const data = await sql(_templateObject8$1 || (_templateObject8$1 = _taggedTemplateLiteral(["\n    SELECT\n      pg_tables.*,\n      pg_class.oid AS tableoid\n    FROM\n      pg_tables\n      LEFT JOIN pg_class ON pg_class.relname = pg_tables.tablename\n      AND pg_class.relnamespace = (\n        SELECT\n          oid\n        FROM\n          pg_namespace\n        WHERE\n          nspname = pg_tables.schemaname\n      )\n    WHERE\n      ", "\n    ORDER BY\n      pg_class.oid ASC\n  "])), whereConditions.flatMap((x, i) => i ? [sql(_templateObject9$1 || (_templateObject9$1 = _taggedTemplateLiteral(["AND"]))), x] : x));
  return data;
};
const selectManyRows = async (sql, tablename) => {
  const columnsMeta = await getTableColumns(sql, tablename);
  const orderBy = resolveOrderBy(columnsMeta);
  const rows = await sql(_templateObject0$1 || (_templateObject0$1 = _taggedTemplateLiteral(["\n    SELECT\n      *\n    FROM\n      ", "\n    ORDER BY\n      ", "\n    LIMIT\n      1000\n  "])), sql(tablename), sql.unsafe(orderBy));
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
const resolveOrderBy = columnsMeta => {
  const hasCreatedAt = columnsMeta.some(c => c.column_name === "created_at");
  if (hasCreatedAt) {
    return "created_at";
  }
  const idCol = columnsMeta.find(c => c.column_name === "id");
  const idIsSerial = idCol && ["integer", "bigint", "smallint"].includes(idCol.data_type) && idCol.column_default && idCol.column_default.startsWith("nextval(");
  if (idIsSerial) {
    return "id";
  }
  return "xmin::text::bigint, ctid";
};
const selectRow = async (sql, tablename, id) => {
  const row = await sql(_templateObject1$1 || (_templateObject1$1 = _taggedTemplateLiteral(["\n    SELECT\n      *\n    FROM\n      ", "\n    WHERE\n      id = ", "\n  "])), sql(tablename), id);
  return row[0];
};
const insertRow = async (sql, tablename, values) => {
  const columnNames = Object.keys(values);
  // Determine table schema to query precise column metadata (always fetch before inserting)
  const [tableInfo] = await sql(_templateObject10$1 || (_templateObject10$1 = _taggedTemplateLiteral(["\n    SELECT\n      schemaname\n    FROM\n      pg_tables\n    WHERE\n      tablename = ", "\n    LIMIT\n      1\n  "])), tablename);
  const schema = tableInfo && tableInfo.schemaname;
  const columnsMeta = await getTableColumns(sql, tablename, schema ? {
    schema
  } : undefined);
  const provided = new Set(columnNames);
  const finalColumns = [...columnNames];
  const finalValues = [...columnNames.map(cn => values[cn])];
  for (const col of columnsMeta) {
    // skip if already provided
    if (provided.has(col.column_name)) {
      continue;
    }
    // respect generated/identity columns and defaults
    const hasDefault = col.column_default !== null;
    const isNullable = String(col.is_nullable).toUpperCase() === "YES";
    const isIdentity = "is_identity" in col && String(col.is_identity).toUpperCase() === "YES" || false;
    const isGeneratedAlways = "is_generated" in col && String(col.is_generated).toUpperCase() === "ALWAYS" || false;
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
    const insertDefault = await sql(_templateObject11$1 || (_templateObject11$1 = _taggedTemplateLiteral(["\n      INSERT INTO\n        ", "\n      DEFAULT VALUES\n      RETURNING\n        *\n    "])), sql(tablename));
    const [insertedRow] = insertDefault;
    return insertedRow;
  }
  const [insertedRow] = await sql(_templateObject12$1 || (_templateObject12$1 = _taggedTemplateLiteral(["\n    INSERT INTO\n      ", " (", ")\n    VALUES\n      (", ")\n    RETURNING\n      *\n  "])), sql(tablename), sql(finalColumns), finalValues);
  return insertedRow;
};
// helper to generate a reasonable value for a required column
const generateValueForColumn = col => {
  const type = (col.udt_name || col.data_type || "").toLowerCase();
  const maxLen = col.character_maximum_length;
  if (type === "uuid") {
    const rand = (globalThis.crypto && globalThis.crypto.randomUUID ? globalThis.crypto.randomUUID() : [4, 2, 2, 2, 6].map(len => [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join("")).join("-")) || "00000000-0000-4000-8000-000000000000";
    return rand;
  }
  if (type.includes("int") || type === "numeric" || type === "decimal" || type === "real" || type === "double precision") {
    return 1;
  }
  if (type === "bool" || type === "boolean") {
    return false;
  }
  if (type === "timestamp" || type === "timestamptz" || type === "date" || type === "time" || type === "timetz") {
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
    defaultValue
  } = columnProperties;
  if (!columnName) {
    const existingColumns = await getTableColumns(sql, tablename);
    const existingNames = new Set(existingColumns.map(c => c.column_name));
    let index = 1;
    columnName = "new_column_".concat(index);
    while (existingNames.has(columnName)) {
      index++;
      columnName = "new_column_".concat(index);
    }
  }
  const nullableClause = nullable ? sql(_templateObject13$1 || (_templateObject13$1 = _taggedTemplateLiteral([""]))) : sql(_templateObject14$1 || (_templateObject14$1 = _taggedTemplateLiteral(["NOT NULL"])));
  const defaultClause = defaultValue !== undefined ? sql(_templateObject15$1 || (_templateObject15$1 = _taggedTemplateLiteral(["DEFAULT ", ""])), defaultValue) : sql(_templateObject16$1 || (_templateObject16$1 = _taggedTemplateLiteral([""])));
  await sql(_templateObject17$1 || (_templateObject17$1 = _taggedTemplateLiteral(["\n    ALTER TABLE ", "\n    ADD COLUMN ", " ", " ", " ", "\n  "])), sql(tablename), sql(columnName), sql.unsafe(dataType), nullableClause, defaultClause);
  const column = await getTableColumn(sql, tablename, columnName);
  return column;
};
const getTableColumn = async (sql, tablename, columnName) => {
  const [column] = await sql(_templateObject18$1 || (_templateObject18$1 = _taggedTemplateLiteral(["\n    SELECT\n      *\n    FROM\n      information_schema.columns\n    WHERE\n      table_name = ", "\n      AND column_name = ", "\n  "])), tablename, columnName);
  return column;
};
// serial/bigserial are pseudo-types; ALTER COLUMN TYPE rejects them.
// Map them to their real underlying type.
const SERIAL_TYPE_MAP = {
  serial: "integer",
  bigserial: "bigint"
};
const updateColumn = async (sql, tablename, column_name, columnProperties) => {
  const {
    column_name: newColumnName,
    data_type,
    nullable,
    default_value,
    generation_expression
  } = columnProperties;
  if (generation_expression !== undefined) {
    // Changing the generation expression requires DROP + ADD COLUMN
    const currentColumn = await getTableColumn(sql, tablename, column_name);
    const columnType = currentColumn.data_type;
    await sql(_templateObject19$1 || (_templateObject19$1 = _taggedTemplateLiteral(["\n      ALTER TABLE ", "\n      DROP COLUMN ", "\n    "])), sql(tablename), sql(column_name));
    await sql(_templateObject20$1 || (_templateObject20$1 = _taggedTemplateLiteral(["\n      ALTER TABLE ", "\n      ADD COLUMN ", " ", " GENERATED ALWAYS AS (", ") STORED\n    "])), sql(tablename), sql(column_name), sql.unsafe(columnType), sql.unsafe(generation_expression));
    return getTableColumn(sql, tablename, column_name);
  }
  const alterClauses = [];
  if (data_type !== undefined) {
    const resolvedDataType = SERIAL_TYPE_MAP[data_type] ?? data_type;
    alterClauses.push(sql(_templateObject21$1 || (_templateObject21$1 = _taggedTemplateLiteral(["\n      ALTER COLUMN ", " TYPE ", "\n    "])), sql(column_name), sql.unsafe(resolvedDataType)));
  }
  const isNullableTrue = nullable === true || String(nullable).toUpperCase() === "YES";
  const isNullableFalse = nullable === false || String(nullable).toUpperCase() === "NO";
  if (isNullableTrue) {
    alterClauses.push(sql(_templateObject22$1 || (_templateObject22$1 = _taggedTemplateLiteral(["\n      ALTER COLUMN ", "\n      DROP NOT NULL\n    "])), sql(column_name)));
  } else if (isNullableFalse) {
    // Before enforcing NOT NULL, fill any existing NULLs with a sensible value
    const currentColumn = await getTableColumn(sql, tablename, column_name);
    if (currentColumn) {
      const fillValue = generateValueForColumn(currentColumn);
      await sql(_templateObject23$1 || (_templateObject23$1 = _taggedTemplateLiteral(["\n        UPDATE ", "\n        SET\n          ", " = ", "\n        WHERE\n          ", " IS NULL\n      "])), sql(tablename), sql(column_name), fillValue, sql(column_name));
    }
    alterClauses.push(sql(_templateObject24$1 || (_templateObject24$1 = _taggedTemplateLiteral(["\n      ALTER COLUMN ", "\n      SET NOT NULL\n    "])), sql(column_name)));
  }
  if (default_value === null) {
    alterClauses.push(sql(_templateObject25$1 || (_templateObject25$1 = _taggedTemplateLiteral(["\n      ALTER COLUMN ", "\n      DROP DEFAULT\n    "])), sql(column_name)));
  } else if (default_value !== undefined) {
    alterClauses.push(sql(_templateObject26$1 || (_templateObject26$1 = _taggedTemplateLiteral(["\n      ALTER COLUMN ", "\n      SET DEFAULT ", "\n    "])), sql(column_name), default_value));
  }
  if (alterClauses.length > 0) {
    await sql(_templateObject27 || (_templateObject27 = _taggedTemplateLiteral(["\n      ALTER TABLE ", " ", "\n    "])), sql(tablename), alterClauses.flatMap((clause, i) => i ? [sql(_templateObject28 || (_templateObject28 = _taggedTemplateLiteral([","]))), clause] : clause));
  }
  const resolvedColumnName = newColumnName ?? column_name;
  if (newColumnName !== undefined && newColumnName !== column_name) {
    // RENAME COLUMN cannot be combined with other ALTER COLUMN clauses
    await sql(_templateObject29 || (_templateObject29 = _taggedTemplateLiteral(["\n      ALTER TABLE ", "\n      RENAME COLUMN ", " TO ", "\n    "])), sql(tablename), sql(column_name), sql(newColumnName));
  }
  return getTableColumn(sql, tablename, resolvedColumnName);
};
const deleteColumn = async (sql, tablename, columnName) => {
  await sql(_templateObject30 || (_templateObject30 = _taggedTemplateLiteral(["\n    ALTER TABLE ", "\n    DROP COLUMN ", "\n  "])), sql(tablename), sql(columnName));
};
const deleteRow = async (sql, tablename, id) => {
  await sql(_templateObject31 || (_templateObject31 = _taggedTemplateLiteral(["\n    DELETE FROM ", "\n    WHERE\n      id = ", "\n  "])), sql(tablename), id);
};
const updateRow = async (sql, tablename, id, values) => {
  if (Object.keys(values).length === 0) {
    return selectRow(sql, tablename, id);
  }
  await sql(_templateObject32 || (_templateObject32 = _taggedTemplateLiteral(["\n    UPDATE ", "\n    SET\n      ", "\n    WHERE\n      id = ", "\n  "])), sql(tablename), sql(values), id);
  const idAfterUpdate = values.id || id;
  return selectRow(sql, tablename, idAfterUpdate);
};

var _templateObject, _templateObject2, _templateObject3, _templateObject4, _templateObject5, _templateObject6, _templateObject7, _templateObject8, _templateObject9, _templateObject0, _templateObject1, _templateObject10, _templateObject11, _templateObject12, _templateObject13, _templateObject14, _templateObject15, _templateObject16, _templateObject17, _templateObject18, _templateObject19, _templateObject20, _templateObject21, _templateObject22, _templateObject23, _templateObject24, _templateObject25, _templateObject26;
const databaseManagerHtmlFileUrl = new URL("./html/database_manager.html", import.meta.url).href;
const jsenvPluginDatabaseManager = ({
  pathname = "/.internal/database/"
} = {}) => {
  let databaseManagerRootDirectoryUrl;
  let defaultUsername;
  let sql;
  return {
    name: "jsenv:database_manager",
    init: async ({
      rootDirectoryUrl
    }) => {
      defaultUsername = execSync("whoami").toString().trim();
      sql = connectAs({
        username: defaultUsername,
        password: "",
        database: "postgres"
      });
      databaseManagerRootDirectoryUrl = new URL(pathname.slice(1), rootDirectoryUrl).href;
    },
    transformUrlContent: {
      html: async urlInfo => {
        const urlWithoutSearch = asUrlWithoutSearch(urlInfo.url);
        if (urlWithoutSearch !== String(databaseManagerHtmlFileUrl)) {
          return null;
        }
        const {
          currentRole,
          currentDatabase
        } = await selectCurrentInfo(sql);
        return {
          contentInjections: {
            __DB_MANAGER_CONFIG__: {
              pathname,
              apiUrl: new URL("".concat(pathname, "api"), urlInfo.context.request.origin).href,
              currentRole,
              currentDatabase
            }
          }
        };
      }
    },
    redirectReference: reference => {
      if (!reference.url.startsWith("file:")) {
        return null;
      }
      const urlWithTrailingSlash = ensurePathnameTrailingSlash(reference.url);
      if (!urlToExtension(reference.url) && urlIsOrIsInsideOf(urlWithTrailingSlash, databaseManagerRootDirectoryUrl)) {
        return databaseManagerHtmlFileUrl;
      }
      return null;
    },
    serverRoutes: [{
      endpoint: "GET ".concat(pathname),
      description: "Manage database using a Web interface",
      declarationSource: import.meta.url,
      fetch: () => {
        // is done by redirectReference
        return null;
      }
    }, {
      endpoint: "GET ".concat(pathname, "api/explorer"),
      description: "Get info about the database manager explorer.",
      declarationSource: import.meta.url,
      fetch: async () => {
        const databaseCount = await countRows(sql, "pg_database");
        const tableCount = await countRows(sql, "pg_tables");
        const roleCounts = await countRoles(sql);
        return Response.json({
          data: {
            databaseCount,
            tableCount,
            roleCounts
          }
        });
      }
    }, ...createRESTRoutes("".concat(pathname, "api/tables"), {
      "GET": async request => {
        const publicFilter = request.searchParams.has("public");
        const tables = await selectTables(sql, {
          publicFilter
        });
        const columns = await getTableColumns(sql, "pg_tables");
        return {
          data: tables,
          meta: {
            columns
          }
        };
      },
      "POST": async request => {
        const {
          tablename
        } = await request.json();
        await createTable(sql, tablename);
        const [table, tableMeta] = await selectTable(sql, tablename);
        return {
          data: table,
          meta: {
            ...tableMeta
          }
        };
      },
      "GET /:tablename": async request => {
        const {
          tablename
        } = request.params;
        const [table, tableMeta] = await selectTable(sql, tablename);
        return {
          data: table,
          meta: {
            ...tableMeta
          }
        };
      },
      "DELETE /:tablename": async request => {
        const {
          tablename
        } = request.params;
        await sql(_templateObject || (_templateObject = _taggedTemplateLiteral(["DROP TABLE ", ""])), sql(tablename));
        return {
          data: null,
          meta: {
            count: await countRows(sql, "pg_tables")
          }
        };
      },
      "DELETE": async request => {
        const tablenames = await request.json();
        if (!Array.isArray(tablenames)) {
          throw new Error("expected an array of tablenames");
        }
        if (tablenames.length === 0) {
          throw new Error("No tablename provided to deletes");
        }
        await sql.begin(async sql => {
          for (const tablename of tablenames) {
            await sql(_templateObject2 || (_templateObject2 = _taggedTemplateLiteral(["DROP TABLE ", ""])), sql(tablename));
          }
        });
        return {
          data: null,
          meta: {
            count: await countRows(sql, "pg_tables")
          }
        };
      },
      "GET /:tablename/columns": async request => {
        const {
          tablename
        } = request.params;
        const columns = await getTableColumns(sql, tablename);
        return {
          data: columns
        };
      },
      "POST /:tablename/columns": async request => {
        const {
          tablename
        } = request.params;
        const data = await request.json();
        const column = await addColumn(sql, tablename, data);
        return {
          data: column
        };
      },
      "DELETE /:tablename/columns/:column_name": async request => {
        const {
          tablename,
          column_name
        } = request.params;
        await deleteColumn(sql, tablename, column_name);
        return null;
      },
      "PATCH /:tablename/columns/:column_name": async request => {
        const {
          tablename,
          column_name
        } = request.params;
        const columnProperties = await request.json();
        const column = await updateColumn(sql, tablename, column_name, columnProperties);
        return {
          data: column
        };
      },
      "PUT /:tablename/columns/:column_name/:column_property": async request => {
        const {
          tablename,
          column_name,
          column_property
        } = request.params;
        const value = await request.json();
        const column = await updateColumn(sql, tablename, column_name, {
          [column_property]: value
        });
        return {
          data: column
        };
      },
      "GET /:tablename/rows": async request => {
        const {
          tablename
        } = request.params;
        const rows = await selectManyRows(sql, tablename);
        return {
          data: rows
        };
      },
      "POST /:tablename/rows": async request => {
        const {
          tablename
        } = request.params;
        const rowData = await request.json();
        const insertedRow = await insertRow(sql, tablename, rowData);
        return {
          data: insertedRow
        };
      },
      "PATCH /:tablename/rows/:rowId": async request => {
        const {
          tablename,
          rowId
        } = request.params;
        const properties = await request.json();
        const updatedRow = await updateRow(sql, tablename, rowId, properties);
        return {
          data: updatedRow
        };
      },
      "DELETE /:tablename/rows/:rowId": async request => {
        const {
          tablename,
          rowId
        } = request.params;
        await deleteRow(sql, tablename, rowId);
        return {
          data: null
        };
      }
    }), ...createRESTRoutes("".concat(pathname, "api/roles"), {
      "GET": async request => {
        const canLogin = request.searchParams.get("can_login");
        let whereClause = "";
        if (canLogin !== null) {
          const canLoginValue = canLogin.toLowerCase();
          if (canLoginValue === "" || canLoginValue === "1" || canLoginValue === "true") {
            whereClause = sql(_templateObject3 || (_templateObject3 = _taggedTemplateLiteral(["\n                WHERE\n                  pg_roles.rolcanlogin = TRUE\n              "])));
          } else if (canLoginValue === "0" || canLoginValue === "false") {
            whereClause = sql(_templateObject4 || (_templateObject4 = _taggedTemplateLiteral(["\n                WHERE\n                  pg_roles.rolcanlogin = FALSE\n              "])));
          }
        }
        const ownersFlag = request.searchParams.has("owners");
        const roles = await sql(_templateObject5 || (_templateObject5 = _taggedTemplateLiteral(["\n            SELECT\n              pg_roles.*,\n              COALESCE(table_count_result.table_count, 0) AS table_count,\n              COALESCE(database_count_result.database_count, 0) AS database_count\n            FROM\n              pg_roles\n              LEFT JOIN (\n                SELECT\n                  tableowner,\n                  COUNT(*) AS table_count\n                FROM\n                  pg_tables\n                WHERE\n                  schemaname NOT IN ('pg_catalog', 'information_schema')\n                GROUP BY\n                  tableowner\n              ) table_count_result ON pg_roles.rolname = table_count_result.tableowner\n              LEFT JOIN (\n                SELECT\n                  pg_roles.rolname AS database_owner,\n                  COUNT(*) AS database_count\n                FROM\n                  pg_database\n                  JOIN pg_roles ON pg_roles.oid = pg_database.datdba\n                GROUP BY\n                  pg_roles.rolname\n              ) database_count_result ON pg_roles.rolname = database_count_result.database_owner ", "\n            ORDER BY\n              pg_roles.oid ASC\n          "])), whereClause || sql(_templateObject6 || (_templateObject6 = _taggedTemplateLiteral([""]))));
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
        const currentRoleResult = await sql(_templateObject7 || (_templateObject7 = _taggedTemplateLiteral(["\n            SELECT\n              current_user\n          "])));
        const currentRoleName = currentRoleResult[0].current_user;
        const [currentRole] = await sql(_templateObject8 || (_templateObject8 = _taggedTemplateLiteral(["\n            SELECT\n              *\n            FROM\n              pg_roles\n            WHERE\n              rolname = ", "\n          "])), currentRoleName);
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
              currentRole
            }
          };
        }
        return {
          data: roles,
          meta: {
            currentRole
          }
        };
      },
      "GET /:rolname": async request => {
        const {
          rolname
        } = request.params;
        const result = await selectRoleByName(sql, rolname);
        if (!result) {
          return null;
        }
        const {
          role,
          ...meta
        } = result;
        return {
          data: role,
          meta
        };
      },
      "POST": async request => {
        const {
          rolname,
          rolcanlogin
        } = await request.json();
        // https://www.postgresql.org/docs/current/sql-createrole.html
        if (rolcanlogin) {
          await sql(_templateObject9 || (_templateObject9 = _taggedTemplateLiteral(["CREATE ROLE ", " LOGIN"])), sql(rolname));
        } else {
          await sql(_templateObject0 || (_templateObject0 = _taggedTemplateLiteral(["CREATE ROLE ", ""])), sql(rolname));
        }
        const [role] = await sql(_templateObject1 || (_templateObject1 = _taggedTemplateLiteral(["\n            SELECT\n              *\n            FROM\n              pg_roles\n            WHERE\n              rolname = ", "\n          "])), rolname);
        return {
          data: role,
          meta: {
            roleCounts: await countRoles(sql)
          }
        };
      },
      // when dropping roles, consider this: https://neon.tech/postgresql/postgresql-administration/postgresql-drop-role
      "DELETE /:rolname": async request => {
        const {
          rolname
        } = request.params;
        await sql(_templateObject10 || (_templateObject10 = _taggedTemplateLiteral(["DROP ROLE ", ""])), sql(rolname));
        return {
          data: null,
          meta: {
            roleCounts: await countRoles(sql)
          }
        };
      },
      "PUT /:rolname/:colname": async request => {
        const {
          rolname,
          colname
        } = request.params;
        const value = await request.json();
        await alterRoleQuery(sql, rolname, colname, value);
        return {
          [colname]: value
        };
      },
      "GET /:rolname/members": async request => {
        const {
          rolname
        } = request.params;
        const members = await sql(_templateObject11 || (_templateObject11 = _taggedTemplateLiteral(["\n            SELECT\n              member_role.*,\n              grantor_role.rolname AS grantor_rolname,\n              pg_auth_members.admin_option\n            FROM\n              pg_auth_members\n              JOIN pg_roles AS parent_role ON pg_auth_members.roleid = parent_role.oid\n              JOIN pg_roles AS member_role ON pg_auth_members.member = member_role.oid\n              LEFT JOIN pg_roles AS grantor_role ON pg_auth_members.grantor = grantor_role.oid\n            WHERE\n              parent_role.rolname = ", "\n          "])), rolname);
        return {
          data: members
        };
      },
      "POST /:rolname/members/:memberRolname": async request => {
        const {
          rolname,
          memberRolname
        } = request.params;
        await sql(_templateObject12 || (_templateObject12 = _taggedTemplateLiteral(["GRANT ", " TO ", ""])), sql(rolname), sql(memberRolname));
        const [memberRole] = await sql(_templateObject13 || (_templateObject13 = _taggedTemplateLiteral(["\n            SELECT\n              *\n            FROM\n              pg_roles\n            WHERE\n              rolname = ", "\n          "])), memberRolname);
        return {
          data: memberRole
        };
      },
      "DELETE /:rolname/members/:memberRolname": async request => {
        const {
          rolname,
          memberRolname
        } = request.params;
        await sql(_templateObject14 || (_templateObject14 = _taggedTemplateLiteral(["\n            REVOKE ", "\n            FROM\n              ", "\n          "])), sql(rolname), sql(memberRolname));
        return {
          data: null
        };
      },
      "GET /:rolname/tables": async request => {
        const {
          rolname
        } = request.params;
        const tables = await selectTables(sql, {
          rolname
        });
        return {
          data: tables,
          meta: {}
        };
      },
      "GET /:rolname/databases": async request => {
        const {
          rolname
        } = request.params;
        const databases = await sql(_templateObject15 || (_templateObject15 = _taggedTemplateLiteral(["\n            SELECT\n              pg_database.*\n            FROM\n              pg_database\n              JOIN pg_roles ON pg_roles.oid = pg_database.datdba\n            WHERE\n              pg_roles.rolname = ", "\n          "])), rolname);
        if (databases.length === 0) {
          return {
            data: []
          };
        }
        return {
          data: databases,
          meta: {}
        };
      }
    }), ...createRESTRoutes("".concat(pathname, "api/databases"), {
      "GET": async () => {
        const [currentDatabaseResult] = await sql(_templateObject16 || (_templateObject16 = _taggedTemplateLiteral(["\n            SELECT\n              current_database()\n          "])));
        const currentDatname = currentDatabaseResult.current_database;
        const [currentDatabase] = await sql(_templateObject17 || (_templateObject17 = _taggedTemplateLiteral(["\n            SELECT\n              *\n            FROM\n              pg_database\n            WHERE\n              datname = ", "\n          "])), currentDatname);
        const databases = await sql(_templateObject18 || (_templateObject18 = _taggedTemplateLiteral(["\n            SELECT\n              *\n            FROM\n              pg_database\n            ORDER BY\n              pg_database.oid ASC\n          "])));
        const countTables = async database => {
          if (database === currentDatname) {
            return countRows(sql, "pg_tables");
          }
          const sqlConnectedToThatDb = connectAs({
            username: defaultUsername,
            password: "",
            database
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
            tableCounts
          }
        };
      },
      "GET /:datname": async request => {
        const {
          datname
        } = request.params;
        const results = await sql(_templateObject19 || (_templateObject19 = _taggedTemplateLiteral(["\n            SELECT\n              pg_database.*,\n              role.rolname AS owner_rolname,\n              role.oid AS owner_oid\n            FROM\n              pg_database\n              LEFT JOIN pg_roles role ON role.oid = pg_database.datdba\n            WHERE\n              pg_database.datname = ", "\n          "])), datname);
        if (results.length === 0) {
          return null;
        }
        const columns = await getTableColumns(sql, "pg_database");
        const [database] = results;
        const ownerRole = database.owner_oid ? {
          oid: database.owner_oid,
          rolname: database.owner_rolname
        } : null;
        delete database.owner_rolname;
        delete database.owner_oid;
        return {
          data: database,
          meta: {
            ownerRole,
            columns
          }
        };
      },
      "POST": async request => {
        const {
          datname
        } = await request.json();
        await sql(_templateObject20 || (_templateObject20 = _taggedTemplateLiteral(["CREATE DATABASE ", ""])), sql(datname));
        const [database] = await sql(_templateObject21 || (_templateObject21 = _taggedTemplateLiteral(["\n            SELECT\n              *\n            FROM\n              pg_database\n            WHERE\n              datname = ", "\n          "])), datname);
        return {
          data: database,
          meta: {
            count: await countRows(sql, "pg_database")
          }
        };
      },
      "DELETE /:datname": async request => {
        const {
          datname
        } = request.params;
        await sql(_templateObject22 || (_templateObject22 = _taggedTemplateLiteral(["DROP DATABASE ", ""])), sql(datname));
        return {
          data: null,
          meta: {
            count: await countRows(sql, "pg_database")
          }
        };
      },
      "PUT /:datname/:colname": async request => {
        const {
          datname,
          colname
        } = request.params;
        const value = await request.json();
        await alterDatabaseQuery(sql, datname, colname, value);
        return {
          [colname]: value
        };
      }
    }), {
      endpoint: "PUT ".concat(pathname, "api/tables/:tableName/columns/name"),
      declarationSource: import.meta.url,
      acceptedMediaTypes: ["application/json"],
      fetch: async request => {
        const tableName = request.params.tableName;
        const tableNewName = await request.json();
        await sql(_templateObject23 || (_templateObject23 = _taggedTemplateLiteral(["\n            ALTER TABLE ", "\n            RENAME TO ", ";\n          "])), sql(tableName), sql(tableNewName));
        return Response.json({
          name: tableNewName
        });
      }
    }, {
      endpoint: "PUT ".concat(pathname, "api/tables/:tableName/columns/rowsecurity"),
      declarationSource: import.meta.url,
      acceptedMediaTypes: ["application/json"],
      fetch: async request => {
        const tableName = request.params.tableName;
        const value = await request.json();
        if (value === "on") {
          await sql(_templateObject24 || (_templateObject24 = _taggedTemplateLiteral(["\n              ALTER TABLE ", " ENABLE ROW LEVEL SECURITY;\n            "])), sql(tableName));
        } else {
          await sql(_templateObject25 || (_templateObject25 = _taggedTemplateLiteral(["\n              ALTER TABLE ", " DISABLE ROW LEVEL SECURITY;\n            "])), sql(tableName));
        }
        return Response.json({
          rowsecurity: value === "on"
        });
      }
    }, {
      endpoint: "PUT ".concat(pathname, "api/tables/:tableName/columns/:columnName/rows/:rowId"),
      declarationSource: import.meta.url,
      acceptedMediaTypes: ["application/json"],
      fetch: async () => {
        // const tableName = request.params.tableName;
        // const columnName = request.params.columnName;
        // const rowId = request.params.rowId;
      }
    },
    // https://wiki.postgresql.org/wiki/Alter_column_position#Add_columns_and_move_data
    {
      endpoint: "PUT ".concat(pathname, "/api/tables/:name/columns/:columnName/move_before"),
      declarationSource: import.meta.url,
      acceptedMediaTypes: ["application/json"],
      fetch: async request => {
        const tableName = request.params.name;
        const columnName = request.params.columnName;
        const beforeColumnName = await request.json();
        if (columnName === beforeColumnName) {
          return Response.json("Column and before column are the same :".concat(columnName), {
            status: 400
          });
        }
        const columns = await sql(_templateObject26 || (_templateObject26 = _taggedTemplateLiteral(["\n            SELECT\n              ordinal_position,\n              data_type\n            FROM\n              information_schema.columns\n            WHERE\n              table_name = ", "\n              AND column_name = ", "\n          "])), sql(tableName), sql(columnName));
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
          return Response.json({
            message: "Column ".concat(columnName, " not found in table ").concat(tableName)
          }, {
            status: 404
          });
        }
        if (beforeColumnIndex === undefined) {
          return Response.json({
            message: "Column ".concat(beforeColumnName, " not found in table ").concat(tableName)
          }, {
            status: 404
          });
        }
        if (beforeColumnIndex === columnIndex - 1) {
          return Response.json("", {
            status: 204
          });
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
              addInstructions.push("ADD COLUMN ".concat(sql(columnBefore.column_name), "_temp ").concat(sql(columnBefore.data_type)));
              setInstructions.push("".concat(sql(columnBefore.column_name), "_temp = ").concat(sql(columnBefore.column_name)));
              removeInstructions.push("DROP COLUMN ".concat(sql(columnBefore.column_name), " cascade"));
              renameInstructions.push("ALTER TABLE ".concat(sql(tableName), " RENAME COLUMN ").concat(sql(columnBefore.column_name), "_temp TO ").concat(sql(columnBefore.column_name)));
            }
          }
          {
            let indexAfter = columnIndex + 1;
            while (indexAfter < columns.length) {
              const columnAfter = columns[indexAfter];
              addInstructions.push("ADD COLUMN ".concat(sql(columnAfter.column_name), "_temp ").concat(sql(columnAfter.data_type)));
              setInstructions.push("".concat(sql(columnAfter.column_name), "_temp = ").concat(sql(columnAfter.column_name)));
              removeInstructions.push("DROP COLUMN ".concat(sql(columnAfter.column_name), " cascade"));
              renameInstructions.push("ALTER TABLE ".concat(sql(tableName), " RENAME COLUMN ").concat(sql(columnAfter.column_name), "_temp TO ").concat(sql(columnAfter.column_name)));
              indexAfter++;
            }
          }
        }
        let query = "";
        {
          query += "\n";
          query += "# add new columns";
          query += "\n";
          query = "ALTER TABLE ".concat(sql(tableName), " ");
          query += addInstructions.join(", ");
          query += ";";
          {
            query += "\n";
            query += "# update new columns";
            query += "\n";
            query += "ALTER TABLE ".concat(sql(tableName));
            query += " SET";
            query += setInstructions.join(", ");
            query += ";";
          }
        }
        {
          query += "\n";
          query += "# remove old columns";
          query += "\n";
          query += "ALTER TABLE ".concat(sql(tableName), " ");
          query += removeInstructions.join(", ");
          query += ";";
        }
        {
          query += "\n";
          query += "# rename new columns";
          query += "\n";
          query += renameInstructions.join("\n");
          query += "\n";
        }
        // here we want to check how the query look like
        debugger;
        await sql.unsafe(query);
        return Response.json(null, {
          status: 204
        });
      }
    }, {
      endpoint: "GET ".concat(pathname, "api"),
      description: "Get info about the database manager API.",
      declarationSource: import.meta.url,
      fetch: () => {
        return Response.json({
          data: {
            pathname,
            apiUrl: new URL("".concat(pathname, "api"), import.meta.url).href
          }
        });
      }
    }, {
      endpoint: "GET ".concat(pathname, "api/*"),
      description: "Fallback for api endpoints (404).",
      declarationSource: import.meta.url,
      fetch: request => {
        return Response.json({
          message: "API endpoint not found: ".concat(request.url)
        }, {
          status: 404
        });
      }
    }],
    serverPlugins: [{
      name: "postgres_sql_error_handler",
      handleError: e => {
        if (!e || e.name !== "PostgresError") {
          return null;
        }
        let message = e.message;
        if (e.detail) {
          message += " (".concat(e.detail, ")");
        }
        const errorData = {
          ...e,
          message
        };
        if (e.code === "2BP01" || e.code === "42710") {
          return Response.json(errorData, {
            status: 409,
            statusText: message.replace(/\n/g, "")
          });
        }
        if (e.code === "42704") {
          return Response.json(errorData, {
            status: 404,
            statusText: message
          });
        }
        return Response.json(errorData, {
          status: 500,
          statusText: message
        });
      }
    }, {
      name: "uncaught_json_parse_error_handler",
      handleError: e => {
        // we assume the error originates from client here
        // but if some JSON.parse fails on the server application code unrelated to the client
        // we would also return 400 while it should be 500
        // ideally every JSON.parse related to the client should be catched
        if (e.name === "SyntaxError" && e.message === "Unexpected end of JSON input") {
          return new Response(null, {
            status: 400,
            statusText: "Invalid JSON input"
          });
        }
        return null;
      }
    }]
  };
};
const createRESTRoutes = (resource, endpoints) => {
  const routes = [];
  const onRoute = ({
    method,
    subpath
  }, handler) => {
    const endpointResource = subpath ? "".concat(resource).concat(subpath) : resource;
    if (method === "GET") {
      const getRoute = {
        endpoint: "GET ".concat(endpointResource),
        declarationSource: import.meta.url,
        fetch: async request => {
          const body = await handler(request);
          if (!body || "data" in body && "meta" in body && (body.data === null || body.data === undefined)) {
            const paramKeys = Object.keys(request.params);
            if (paramKeys.length) {
              const identifier = request.params[paramKeys[0]];
              return Response.json({
                message: "".concat(endpointResource, " \"").concat(identifier, "\" not found")
              }, {
                status: 404
              });
            }
            return Response.json({
              message: "".concat(endpointResource, " not found")
            }, {
              status: 404
            });
          }
          return Response.json(body);
        }
      };
      routes.push(getRoute);
      return;
    }
    if (method === "POST") {
      const postRoute = {
        endpoint: "POST ".concat(endpointResource),
        declarationSource: import.meta.url,
        acceptedMediaTypes: ["application/json"],
        fetch: async request => {
          const body = await handler(request);
          return Response.json(body, {
            status: 201
          });
        }
      };
      routes.push(postRoute);
      return;
    }
    if (method === "PATCH") {
      const patchRoute = {
        endpoint: "PATCH ".concat(endpointResource),
        declarationSource: import.meta.url,
        acceptedMediaTypes: ["application/json"],
        fetch: async request => {
          const body = await handler(request);
          return Response.json(body);
        }
      };
      routes.push(patchRoute);
      return;
    }
    if (method === "PUT") {
      const putRoute = {
        endpoint: "PUT ".concat(endpointResource),
        declarationSource: import.meta.url,
        fetch: async request => {
          const body = await handler(request);
          return Response.json(body);
        }
      };
      routes.push(putRoute);
      return;
    }
    if (method === "DELETE") {
      const deleteRoute = {
        endpoint: "DELETE ".concat(endpointResource),
        declarationSource: import.meta.url,
        fetch: async request => {
          const body = await handler(request);
          return body === null || body === undefined ? new Response(null, {
            status: 204
          }) : Response.json(body);
        }
      };
      routes.push(deleteRoute);
      return;
    }
  };
  for (const key of Object.keys(endpoints)) {
    if (key.includes(" ")) {
      const [method, subpath] = key.split(" ");
      onRoute({
        method,
        subpath
      }, endpoints[key]);
    } else {
      onRoute({
        method: key
      }, endpoints[key]);
    }
  }
  return routes;
};

export { jsenvPluginDatabaseManager };
