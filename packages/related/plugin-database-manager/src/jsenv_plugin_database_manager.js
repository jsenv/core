/**
 *
 * - nom des tables au singulier
 */

import {
  urlToExtension,
  urlIsOrIsInsideOf,
  ensurePathnameTrailingSlash,
} from "@jsenv/urls";
import { readParamsFromContext, connectAs } from "@jsenv/database";
import { alterRoleQuery } from "./sql/alter_role_query.js";
import { alterDatabaseQuery } from "./sql/alter_database_query.js";

const databaseManagerHtmlFileUrl = import.meta.resolve(
  "./client/database_manager.html",
);

export const jsenvPluginDatabaseManager = () => {
  let databaseManagerRootDirectoryUrl;
  let sql;

  const createRESTRoutes = (resource, { GET, POST, PUT, DELETE }) => {
    const routes = [];
    if (GET) {
      const getRoute = {
        endpoint: `GET /.internal/database/api/${resource}/:id`,
        declarationSource: import.meta.url,
        fetch: async (request) => {
          const id = request.params.id;
          const object = await GET(id);
          if (!object) {
            return Response.json(`${resource} "${id}" not found`, {
              status: 404,
            });
          }
          return Response.json(object);
        },
      };
      routes.push(getRoute);
    }
    if (POST) {
      const postRoute = {
        endpoint: `POST /.internal/database/api/${resource}`,
        declarationSource: import.meta.url,
        acceptedMediaTypes: ["application/json"],
        fetch: async (request) => {
          const properties = await request.json();
          const object = await POST(properties);
          return Response.json(object, { status: 201 });
        },
      };
      routes.push(postRoute);
    }
    if (PUT) {
      const putRoute = {
        endpoint: `PUT /.internal/database/api/${resource}/:id/:property`,
        declarationSource: import.meta.url,
        fetch: async (request) => {
          const id = request.params.id;
          const property = request.params.property;
          const value = await request.json();
          await PUT(id, property, value);
          return Response.json({ [property]: value });
        },
      };
      routes.push(putRoute);
    }
    if (DELETE) {
      const deleteRoute = {
        endpoint: `DELETE /.internal/database/api/${resource}/:id`,
        declarationSource: import.meta.url,
        fetch: async (request) => {
          const id = request.params.id;
          await DELETE(id);
          return new Response(null, { status: 204 });
        },
      };
      routes.push(deleteRoute);
    }
    return routes;
  };

  return {
    name: "jsenv:database_manager",
    init: async ({ rootDirectoryUrl }) => {
      const { defaultUsername, database } = readParamsFromContext();
      sql = connectAs({ username: defaultUsername, password: "", database });
      databaseManagerRootDirectoryUrl = new URL(
        "./.internal/database/",
        rootDirectoryUrl,
      ).href;
    },
    redirectReference: (reference) => {
      if (!reference.url.startsWith("file:")) {
        return null;
      }
      const urlWithTrailingSlash = ensurePathnameTrailingSlash(reference.url);
      if (
        !urlToExtension(reference.url) &&
        urlIsOrIsInsideOf(urlWithTrailingSlash, databaseManagerRootDirectoryUrl)
      ) {
        return databaseManagerHtmlFileUrl;
      }
      return null;
    },

    devServerRoutes: [
      {
        endpoint: "GET /.internal/database",
        description: "Manage database using a Web interface",
        declarationSource: import.meta.url,
        fetch: () => {
          // is done by redirectReference
          return null;
        },
      },
      {
        endpoint: "GET /.internal/database/api/nav",
        description:
          "Get info about the database that can be used to build a navbar",
        declarationSource: import.meta.url,
        fetch: async () => {
          const currentRoleResult = await sql`
            SELECT
              current_user
          `;
          const currentRoleName = currentRoleResult[0].current_user;
          const currentRoleResults = await sql`
            SELECT
              *
            FROM
              pg_roles
            WHERE
              rolname = ${currentRoleName}
          `;
          const roles = await sql`
            SELECT
              *
            FROM
              pg_roles
          `;
          return Response.json({
            currentRole: currentRoleResults[0],
            roles,
          });
        },
      },
      ...createRESTRoutes("roles", {
        GET: async (rolname) => {
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
          return {
            role,
            databases,
            objects,
            // privileges,
            columns,
          };
        },
        PUT: async (rolname, colname, value) => {
          await alterRoleQuery(sql, rolname, colname, value);
        },
        POST: async ({ rolname }) => {
          // ideally we would support more options like
          // const { rolname, ...options} = role and pass them to the sql query
          // as documented in https://www.postgresql.org/docs/current/sql-createrole.html
          // but we need only the name for now
          await sql`CREATE ROLE ${sql(rolname)}`;
          const [role] = await sql`
            SELECT
              *
            FROM
              pg_roles
            WHERE
              rolname = ${rolname}
          `;
          return role;
        },
        // when dropping roles, consider this: https://neon.tech/postgresql/postgresql-administration/postgresql-drop-role
        DELETE: async (rolname) => {
          await sql`DROP ROLE ${sql(rolname)}`;
        },
      }),
      ...createRESTRoutes("databases", {
        GET: async (datname) => {
          const results = await sql`
            SELECT
              pg_database.*,
              role.rolname AS owner_rolname
            FROM
              pg_database
              LEFT JOIN pg_roles role ON pg_database.datdba = role.oid
            WHERE
              pg_database.datname = ${datname}
          `;
          if (results.length === 0) {
            return null;
          }
          const columns = await getTableColumns(sql, "pg_database");
          const [database] = results;
          const ownerRole = database.datdba
            ? {
                oid: database.datdba,
                rolname: database.owner_rolname,
              }
            : null;
          delete database.datdba;
          delete database.owner_rolname;

          return { database, ownerRole, columns };
        },
        PUT: async (datname, colname, value) => {
          await alterDatabaseQuery(sql, datname, colname, value);
        },
        POST: async ({ datname }) => {
          await sql`CREATE ROLE ${sql(datname)}`;
          const [database] = await sql`
            SELECT
              *
            FROM
              pg_database
            WHERE
              datname = ${datname}
          `;
          return database;
        },
        DELETE: async (datname) => {
          await sql`DROP DATABASE ${sql(datname)}`;
        },
      }),
      {
        endpoint: "GET /.internal/database/api/tables",
        declarationSource: import.meta.url,
        fetch: async (request) => {
          const publicFilter = request.searchParams.has("public"); // TODO: a dynamic filter param
          const columns = await getTableColumns(sql, "pg_tables");
          const data = await sql`
            SELECT
              *
            FROM
              pg_tables ${publicFilter
              ? sql`
                  WHERE
                    schemaname = 'public'
                `
              : sql``}
          `;
          return Response.json({ columns, data });
        },
      },
      {
        endpoint: "PUT /.internal/database/api/tables/:tableName/columns/name",
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
        endpoint:
          "PUT /.internal/database/api/tables/:tableName/columns/rowsecurity",
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
        endpoint:
          "PUT /.internal/database/api/tables/:tableName/columns/:columnName/rows/:rowId",
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
        endpoint:
          "PUT /.internal/database/api/tables/:name/columns/:columnName/move_before",
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
              `Column ${columnName} not found in table ${tableName}`,
              { status: 404 },
            );
          }
          if (beforeColumnIndex === undefined) {
            return Response.json(
              `Column ${beforeColumnName} not found in table ${tableName}`,
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
          copy_new_columns: {
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
          remove_old_columns: {
            query += "\n";
            query += `# remove old columns`;
            query += "\n";
            query += `ALTER TABLE ${sql(tableName)} `;
            query += removeInstructions.join(", ");
            query += `;`;
          }
          rename_new_columns: {
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
    ],
    devServerServices: [
      {
        name: "postgres_sql_error_handler",
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
              statusText: message,
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
      },
    ],
  };
};

const getTableColumns = async (sql, tableName) => {
  const columns = await sql`
    SELECT
      *
    FROM
      information_schema.columns
    WHERE
      table_name = ${tableName}
  `;
  return columns;
};
