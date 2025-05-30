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
