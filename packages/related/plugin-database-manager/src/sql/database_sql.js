// https://www.postgresql.org/docs/14/sql-alterdatabase.html

export const alterDatabaseQuery = async (sql, datname, colname, value) => {
  if (colname === "datdba") {
    await sql`ALTER DATABASE ${sql(datname)} OWNER TO ${sql(value)}`;
  }
};
