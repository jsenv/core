#!/usr/bin/env node

import { UNICODE } from "@jsenv/humanize";
import { execSync } from "node:child_process";
import { platform } from "node:os";
import { parseArgs } from "node:util";

const options = {
  help: {
    type: "boolean",
  },
};
const commands = {
  help: () => {
    console.log(`@jsenv/database: CLI to manage database.

Usage: npx @jsenv/database [command]

https://github.com/jsenv/importmap-node-module

Command:
  help      Display this message.
  install   Install the database (postgresql) on the current machine.`);
  },
  install: () => {
    const platformName = platform();
    if (platformName === "darwin") {
      console.log("Detected macOS. Installing PostgreSQL using Homebrew...");
      execSync("brew install postgresql", { stdio: "inherit" });
      return;
    }
    if (platformName === "linux") {
      console.log("Detected Linux. Installing PostgreSQL using apt...");
      execSync("sudo apt-get update && sudo apt-get install -y postgresql", {
        stdio: "inherit",
      });
      return;
    }
    if (platformName === "win32") {
      console.log(
        "Detected Windows. Installing PostgreSQL using Chocolatey...",
      );
      execSync("choco install postgresql --confirm", { stdio: "inherit" });
      return;
    }
    throw new Error(`Unsupported operating system: ${platformName}`);
  },
  start: () => {
    const platformName = platform();
    if (platformName === "darwin") {
      console.log("Detected macOS. Starting PostgreSQL...");
      execSync("brew services start postgresql", { stdio: "inherit" });
      return;
    }
    if (platformName === "linux") {
      console.log("Detected Linux. Starting PostgreSQL...");
      execSync("sudo service postgresql start", { stdio: "inherit" });
      return;
    }
    if (platformName === "win32") {
      console.log("Detected Windows. Starting PostgreSQL...");
      execSync('pg_ctl -D "C:\\Program Files\\PostgreSQL\\14\\data" start', {
        stdio: "inherit",
      });
      return;
    }
    throw new Error(`Unsupported operating system: ${platformName}`);
  },
  stop: () => {
    const platformName = platform();
    if (platformName === "darwin") {
      console.log("Detected macOS. Stopping PostgreSQL...");
      execSync("brew services stop postgresql", { stdio: "inherit" });
      return;
    }
    if (platformName === "linux") {
      console.log("Detected Linux. Stopping PostgreSQL...");
      execSync("sudo service postgresql stop", { stdio: "inherit" });
      return;
    }
    if (platformName === "win32") {
      console.log("Detected Windows. Stopping PostgreSQL...");
      execSync('pg_ctl -D "C:\\Program Files\\PostgreSQL\\14\\data" stop', {
        stdio: "inherit",
      });
      return;
    }
    throw new Error(`Unsupported operating system: ${platformName}`);
  },
  setup: async () => {
    const { default: postgres } = await import("postgres");

    const defaultUsername = execSync("whoami").toString().trim();
    const host = "localhost";
    const port = 5432;
    const databaseUrl = `postgresql://${defaultUsername}@${host}:${port}`;
    console.log(`${UNICODE.INFO} Connecting to ${databaseUrl}`);
    const sql = postgres({
      host: "localhost",
      port: 5432,
      database: "postgres",
      username: defaultUsername,
      password: "",
    });
    console.log(`${UNICODE.OK} Connected to database`);

    // TODO: read this from secrets.json?
    const databaseName = "jsenv";
    const adminRole = "admin";
    const username = "me";
    const password = "password";

    admin_role_setup: {
      console.log(`${UNICODE.INFO} Check role "${adminRole}":`);
      const roles = await sql`
SELECT
  rolname AS role_name,
  rolcreatedb as can_create_db,
  rolcanlogin as can_login
FROM pg_roles
WHERE rolname=${adminRole};`;
      if (roles.length === 0) {
        console.log(
          `  ${UNICODE.INFO} Role "${adminRole}" not found, creating it...`,
        );
        await sql`CREATE ROLE ${sql(adminRole)} LOGIN CREATEDB;`;
        console.log(`${UNICODE.OK} Role "${adminRole}" created`);
      } else {
        const [{ role_name, can_create_db, can_login }] = roles;
        if (can_create_db && can_login) {
          console.log(
            `  ${UNICODE.OK} "${role_name}" role exists with the right attributes.`,
          );
        } else {
          console.log(
            `  ${UNICODE.INFO} LOGIN and CREATEDB attributes are missing on role "${adminRole}".`,
          );
          await sql`ALTER ROLE ${sql(adminRole)} LOGIN CREATEDB;`;
          console.log(
            `  ${UNICODE.OK} LOGIN and CREATEDB attributes added to role "${adminRole}".`,
          );
        }
      }
    }
    user_setup: {
      console.log(`${UNICODE.INFO} Check user "${username}":`);
      const users = await sql`
SELECT
  usename AS user_name,
  usecreatedb AS can_create_db
FROM pg_user
WHERE usename=${username};`;
      if (users.length === 0) {
        console.log(`  ${UNICODE.INFO} not found, creating it...`);
        await sql`CREATE USER ${sql(username)} WITH PASSWORD '${sql(password)}';`;
        console.log(`  ${UNICODE.OK} "${username}" created`);
        await sql`GRANT ${sql(adminRole)} TO ${sql(username)};`;
        console.log(
          `  ${UNICODE.OK} Role "${adminRole}" granted to user "${username}"`,
        );
      } else {
        const roleGrantResults = await sql`
SELECT 1
FROM pg_user u
JOIN pg_auth_members m ON u.usesysid = m.member
JOIN pg_roles r ON m.roleid = r.oid
WHERE u.usename = ${username}`;
        if (roleGrantResults.length === 0) {
          console.log(
            `  ${UNICODE.INFO} Role "${adminRole}" is missing on user.`,
          );
          await sql`GRANT ${sql(adminRole)} TO ${sql(username)};`;
          console.log(`  ${UNICODE.OK} Role "${adminRole}" assigned to user.`);
        } else {
          console.log(`  ${UNICODE.OK} User found with role "${adminRole}".`);
        }
      }
    }
    database_setup: {
      console.log(`${UNICODE.INFO} Check database "${databaseName}":`);
      const databases = await sql`
SELECT 1
FROM pg_database
WHERE datname = ${databaseName};`;
      if (databases.length === 0) {
        console.log(`  ${UNICODE.INFO} not found, creating it...`);
        await sql`CREATE DATABASE ${sql(databaseName)} OWNER ${sql(username)}`;
        console.log(`  ${UNICODE.OK} Database "${databaseName}" created.`);
      } else {
        console.log(`  ${UNICODE.OK} Database "${databaseName}" found.`);
      }
    }
    await sql.end();
  },
};

await commands.setup();

const { values, positionals } = parseArgs({ options, allowPositionals: true });
if (values.help || positionals.length === 0) {
  commands.help();
  process.exit(0);
}
if (positionals.length > 1) {
  console.error("Error: too many inputs.");
  process.exit(1);
}
const command = positionals[0];
if (command === "help") {
  commands.help();
  process.exit(0);
}
const commandFunction = commands[command];
if (!commandFunction) {
  console.error(`Error: unknown command "${command}".`);
  commands.help();
  process.exit(1);
}
await commandFunction(values);
