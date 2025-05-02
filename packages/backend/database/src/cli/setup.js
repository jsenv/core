import { config } from "dotenv";
import postgres from "postgres";
import { UNICODE } from "@jsenv/humanize";
import { execSync } from "node:child_process";
import { urlToRelativeUrl } from "@jsenv/urls";
import { pathToFileURL, fileURLToPath } from "node:url";
// import { readFileSync } from "node:fs";

config({
  path:
    process.env.NODE_ENV === "production" || process.env.NODE_ENV === "prod"
      ? ".env.prod"
      : ".env.dev",
});

if (!process.env.DB_NAME) {
  throw new Error("process.env.DB_NAME is not set");
}
if (!process.env.DB_USER_ROLE_NAME) {
  throw new Error("process.env.DB_USER_ROLE_NAME is not set");
}
if (!process.env.DB_USER_NAME) {
  throw new Error("process.env.DB_USER_NAME is not set");
}
if (!process.env.DB_USER_PASSWORD) {
  throw new Error("process.env.DB_USER_PASSWORD is not set");
}

const host = process.env.DB_HOST || "localhost";
const port = process.env.DB_PORT || 5432;
const databaseName = process.env.DB_NAME;
const userRoleName = process.env.DB_USER_ROLE_NAME;
const username = process.env.DB_USER_NAME;
const password = process.env.DB_USER_PASSWORD;

const defaultUsername = execSync("whoami").toString().trim();
const databaseUrl = `postgresql://${defaultUsername}@${host}:${port}`;
console.log(`${UNICODE.INFO} Connecting to ${databaseUrl}...`);
const sql = postgres({
  host: "localhost",
  port: 5432,
  database: "postgres",
  username: defaultUsername,
  password: "",
});
const setupIndent = "  ";
console.log(`${UNICODE.OK} Connected to database`);
console.log("");

role_setup: {
  console.log(`- Setup role "${userRoleName}":`);
  const roles = await sql`
    SELECT
      rolname AS role_name,
      rolcreatedb AS can_create_db,
      rolcanlogin AS can_login
    FROM
      pg_roles
    WHERE
      rolname = ${userRoleName};
  `;
  if (roles.length === 0) {
    console.log(
      `${setupIndent}${UNICODE.INFO} Role "${userRoleName}" not found, creating it...`,
    );
    await sql`CREATE ROLE ${sql(userRoleName)} LOGIN CREATEDB;`;
    console.log(`${setupIndent}${UNICODE.OK} Role "${userRoleName}" created`);
  } else {
    const [{ role_name, can_create_db, can_login }] = roles;
    if (can_create_db && can_login) {
      console.log(
        `${setupIndent}${UNICODE.OK} "${role_name}" role exists with the right attributes.`,
      );
    } else {
      console.log(
        `${setupIndent}${UNICODE.INFO} LOGIN and CREATEDB attributes are missing on role "${userRoleName}".`,
      );
      await sql`ALTER ROLE ${sql(userRoleName)} LOGIN CREATEDB;`;
      console.log(
        `${setupIndent}${UNICODE.OK} LOGIN and CREATEDB attributes added to role "${userRoleName}".`,
      );
    }
  }
}
user_setup: {
  console.log(`- Setup user "${username}":`);
  const users = await sql`
    SELECT
      usename AS user_name,
      usecreatedb AS can_create_db
    FROM
      pg_user
    WHERE
      usename = ${username};
  `;
  if (users.length === 0) {
    console.log(`${setupIndent}${UNICODE.INFO} not found, creating it...`);
    await sql`
      CREATE USER ${sql(username)}
      WITH
        PASSWORD '${sql(password)}';
    `;
    console.log(`${setupIndent}${UNICODE.OK} "${username}" created`);
    await sql`GRANT ${sql(userRoleName)} TO ${sql(username)};`;
    console.log(
      `${setupIndent}${UNICODE.OK} Role "${userRoleName}" granted to user "${username}"`,
    );
  } else {
    const roleGrantResults = await sql`
      SELECT
        1
      FROM
        pg_user u
        JOIN pg_auth_members m ON u.usesysid = m.member
        JOIN pg_roles r ON m.roleid = r.oid
      WHERE
        u.usename = ${username}
    `;
    if (roleGrantResults.length === 0) {
      console.log(
        `${setupIndent}${UNICODE.INFO} Role "${userRoleName}" is missing on user.`,
      );
      await sql`GRANT ${sql(userRoleName)} TO ${sql(username)};`;
      console.log(
        `${setupIndent}${UNICODE.OK} Role "${userRoleName}" assigned to user.`,
      );
    } else {
      console.log(
        `${setupIndent}${UNICODE.OK} User found with role "${userRoleName}".`,
      );
    }
  }
}
database_setup: {
  console.log(`- Setup database "${databaseName}":`);
  const databases = await sql`
    SELECT
      1
    FROM
      pg_database
    WHERE
      datname = ${databaseName};
  `;
  if (databases.length === 0) {
    console.log(`${setupIndent}${UNICODE.INFO} not found, creating it...`);
    await sql.unsafe`CREATE DATABASE ${databaseName} OWNER ${username}`;
    console.log(
      `${setupIndent}${UNICODE.OK} Database "${databaseName}" created.`,
    );
  } else {
    console.log(
      `${setupIndent}${UNICODE.OK} Database "${databaseName}" found.`,
    );
  }
}
schemas_setup: {
  console.log(`- Setup schemas:`);
  const schemaFiles = process.env.DB_SCHEMA_FILES;
  if (!schemaFiles) {
    console.log(
      `${setupIndent}${UNICODE.INFO} No schema files configured, skipping.`,
    );
    break schemas_setup;
  }

  const directoryUrl = `${pathToFileURL(process.cwd())}/`;
  console.log(
    `${setupIndent}${UNICODE.INFO} Search files matching "${schemaFiles}" in ${directoryUrl}...`,
  );
  const { listFilesMatching } = await import("@jsenv/filesystem");
  const patterns = {};
  for (const pattern of schemaFiles.split(", ")) {
    patterns[pattern] = true;
  }

  const files = await listFilesMatching({ patterns, directoryUrl });
  if (files.length === 0) {
    console.log(`${setupIndent}${UNICODE.INFO} No files found, skipping.`);
    break schemas_setup;
  }
  console.log(`${setupIndent}${UNICODE.OK} ${files.length} file(s) found`);
  for (const file of files) {
    console.log(
      `${setupIndent}${UNICODE.INFO} executing ${urlToRelativeUrl(file, directoryUrl)}...`,
    );
    await sql.file(fileURLToPath(new URL(file)));
    // const sqlToExecute = readFileSync(, "utf8");
    // await sql`${sqlToExecute}`.simple();
    console.log(`${setupIndent}${UNICODE.OK} done.`);
  }
}

console.log("");
console.log(`${UNICODE.INFO} Disconnecting from database...`);
await sql.end();
console.log(`${UNICODE.OK} Disconnected`);
