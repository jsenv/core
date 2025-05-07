export const alterRoleQuery = async (sql, roleName, columnName, value) => {
  if (columnName === "rolname") {
    return sql`
      ALTER ROLE ${sql(roleName)}
      RENAME TO ${sql.unsafe(value)}
    `;
  }
  const keywords = booleanOptionKeywords[columnName];
  if (keywords) {
    return sql`
      ALTER ROLE ${sql(roleName)} ${sql.unsafe(keywords[value ? 0 : 1])}
    `;
  }
  if (columnName === "rolvaliduntil") {
    return sql` ALTER ROLE ${sql(roleName)} VALID UNTIL '${sql.unsafe(value)}'`;
  }
  if (columnName === "rolconnlimit") {
    return sql`
      ALTER ROLE ${sql(roleName)} CONNECTION
      LIMIT
        ${sql.unsafe(value)}
    `;
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
