import { getTableColumns } from "./database_sql.js";

export const selectRoleByName = async (sql, rolname) => {
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

export const alterRoleQuery = async (sql, rolname, columnName, value) => {
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
