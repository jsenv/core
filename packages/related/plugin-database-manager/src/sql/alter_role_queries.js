export const alterRoleQuery = async (sql, roleName, columnName, value) => {
  const keywords = columnKeywords[columnName];
  if (keywords) {
    return sql`ALTER ROLE ${sql(roleName)} ${sql(keywords[value ? 0 : 1])}`;
  }
  return null;
};

const columnKeywords = {
  rolsuper: ["SUPERUSER", "NOSUPERUSER"],
  rolinherit: ["INHERIT", "NOINHERIT"],
};
