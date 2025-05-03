/**
 *
 * - nom des tables au singulier
 */

import {
  urlToPathname,
  urlToExtension,
  urlIsInsideOf,
  ensurePathnameTrailingSlash,
} from "@jsenv/urls";
import { readParamsFromContext, connectAs } from "@jsenv/database";

const databaseManagerHtmlFileUrl = import.meta.resolve(
  "./client/database_manager.html",
);

export const jsenvPluginDatabaseManager = () => {
  let databaseManagerRootDirectoryUrl;
  let sql;

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
      if (
        ensurePathnameTrailingSlash(reference.url) ===
        databaseManagerRootDirectoryUrl
      ) {
        return databaseManagerHtmlFileUrl;
      }
      if (
        urlIsInsideOf(reference.url, databaseManagerRootDirectoryUrl) &&
        !urlToExtension(reference.url) &&
        !urlToPathname(reference.url).endsWith("/")
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
        endpoint: "GET /.internal/database/api/tables",
        declarationSource: import.meta.url,
        fetch: async (request) => {
          const publicFilter = request.searchParams.has("public"); // TODO: a dynamic filter param
          const columns = await sql`
            SELECT
              *
            FROM
              information_schema.columns
            WHERE
              table_name = 'pg_tables'
          `;
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
        endpoint: "PUT /.internal/database/api/tables/:name/name",
        declarationSource: import.meta.url,
        acceptedMediaTypes: ["application/json"],
        fetch: async (request) => {
          const tableName = request.params.name;
          const tableNewName = await request.json();
          await sql`
            ALTER TABLE ${sql(tableName)}
            RENAME TO ${sql(tableNewName)};
          `;
          return Response.json({ name: tableNewName });
        },
      },
      {
        endpoint: "PUT /.internal/database/api/tables/:name/rowsecurity",
        declarationSource: import.meta.url,
        acceptedMediaTypes: ["application/json"],
        fetch: async (request) => {
          const tableName = request.params.name;
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
      // https://wiki.postgresql.org/wiki/Alter_column_position#Add_columns_and_move_data
      {
        endpoint:
          "PUT /.internal/database/api/tables/:name/columns/:columnName/ordinal_position",
        declarationSource: import.meta.url,
        acceptedMediaTypes: ["application/json"],
        fetch: async (request) => {
          const tableName = request.params.name;
          const columnName = request.params.columnName;
          const value = await request.json();
          // first I need to know the current column position and type
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
          const columnIndex = columns.findIndex(
            (column) => column.column_name === columnName,
          );
          const column = columns[columnIndex];
          if (column.ordinal_position === value) {
            return Response.json({ ordinal_position: value });
          }
          const columnAfterThisOneArray = columns.slice(columnIndex + 1);
          add_new_columns: {
            let query = `ALTER TABLE ${sql(tableName)}`;
            const addInstructions = [];
            for (const columnAfterThisOne of columnAfterThisOneArray) {
              addInstructions.push(
                `ADD COLUMN ${sql(columnAfterThisOne.column_name)}_temp ${sql(
                  columnAfterThisOne.data_type,
                )}`,
              );
            }
            query += ` `;
            query += addInstructions.join(", ");
            query += `;`;
            await sql(query);
          }
          update_new_columns: {
            let query = `ALTER TABLE ${sql(tableName)}`;
            const copyInstructions = [];
            for (const columnAfterThisOne of columnAfterThisOneArray) {
              copyInstructions.push(
                `${sql(columnAfterThisOne.column_name)}_temp = ${sql(
                  columnAfterThisOne.column_name,
                )}`,
              );
            }
            query += ` SET`;
            query += copyInstructions.join(", ");
            query += `;`;
            await sql(query);
          }
          remove_old_columns: {
            let query = `ALTER TABLE ${sql(tableName)}`;
            const removeInstructions = [];
            for (const columnAfterThisOne of columnAfterThisOneArray) {
              removeInstructions.push(
                `DROP COLUMN ${sql(columnAfterThisOne.column_name)} cascade`,
              );
            }
            query += ` `;
            query += removeInstructions.join(", ");
            query += `;`;
            await sql(query);
          }
          rename_new_columns: {
            for (const columnAfterThisOne of columnAfterThisOneArray) {
              await sql(
                `ALTER TABLE ${sql(tableName)} RENAME COLUMN ${sql(columnAfterThisOne.column_name)}_temp TO ${sql(
                  columnAfterThisOne.column_name,
                )}`,
              );
            }
          }
          return Response.json({ ordinal_position: value });
        },
      },
    ],
  };
};
