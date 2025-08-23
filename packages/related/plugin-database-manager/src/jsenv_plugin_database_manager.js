/**
 *
 * - nom des tables au singulier
 */

import { connectAs } from "@jsenv/database";
import {
  asUrlWithoutSearch,
  ensurePathnameTrailingSlash,
  urlIsOrIsInsideOf,
  urlToExtension,
} from "@jsenv/urls";
import { execSync } from "node:child_process";
import { alterDatabaseQuery } from "./sql/database_sql.js";
import {
  countRoles,
  countRows,
  getTableColumns,
  selectCurrentInfo,
} from "./sql/manage_sql.js";
import { alterRoleQuery, selectRoleByName } from "./sql/role_sql.js";
import {
  alterTableQuery,
  createTable,
  insertRow,
  selectTable,
  selectTables,
} from "./sql/table_sql.js";

const databaseManagerHtmlFileUrl = import.meta.resolve(
  "./client/database_manager.html",
);

export const jsenvPluginDatabaseManager = ({
  pathname = "/.internal/database/",
} = {}) => {
  let databaseManagerRootDirectoryUrl;
  let defaultUsername;
  let sql;

  return {
    name: "jsenv:database_manager",
    init: async ({ rootDirectoryUrl }) => {
      defaultUsername = execSync("whoami").toString().trim();
      sql = connectAs({
        username: defaultUsername,
        password: "",
        database: "postgres",
      });
      databaseManagerRootDirectoryUrl = new URL(
        pathname.slice(1),
        rootDirectoryUrl,
      ).href;
    },
    transformUrlContent: {
      html: async (urlInfo) => {
        const urlWithoutSearch = asUrlWithoutSearch(urlInfo.url);
        if (urlWithoutSearch !== String(databaseManagerHtmlFileUrl)) {
          return null;
        }

        const { currentRole, currentDatabase } = await selectCurrentInfo(sql);

        return {
          contentInjections: {
            __DB_MANAGER_CONFIG__: {
              pathname,
              apiUrl: new URL(`${pathname}api`, urlInfo.context.request.origin)
                .href,
              currentRole,
              currentDatabase,
            },
          },
        };
      },
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
        endpoint: `GET ${pathname}`,
        description: "Manage database using a Web interface",
        declarationSource: import.meta.url,
        fetch: () => {
          // is done by redirectReference
          return null;
        },
      },
      {
        endpoint: `GET ${pathname}api/explorer`,
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
              roleCounts,
            },
          });
        },
      },
      ...createRESTRoutes(`${pathname}api/tables`, {
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
        "PUT /:tablename/:colname": async (request) => {
          const { tablename, colname } = request.params;
          const value = await request.json();
          await alterTableQuery(sql, tablename, colname, value);
          return { [colname]: value };
        },
        "GET /:tablename/rows": async (request) => {
          const { tablename } = request.params;
          const rows = await sql`
            SELECT
              *
            FROM
              ${sql(tablename)}
            LIMIT
              1000
          `;
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
      }),
      ...createRESTRoutes(`${pathname}api/roles`, {
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
          const result = await selectRoleByName(rolname);
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
      ...createRESTRoutes(`${pathname}api/databases`, {
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
        endpoint: `PUT ${pathname}api/tables/:tableName/columns/name`,
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
        endpoint: `PUT ${pathname}api/tables/:tableName/columns/rowsecurity`,
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
        endpoint: `PUT ${pathname}api/tables/:tableName/columns/:columnName/rows/:rowId`,
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
        endpoint: `PUT ${pathname}/api/tables/:name/columns/:columnName/move_before`,
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
      {
        endpoint: `GET ${pathname}api`,
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
        endpoint: `GET ${pathname}api/*`,
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
      },
      {
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
