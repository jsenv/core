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
      // surement mieux que je me logue comme superuser
      // sinon je peux pas changer les owner etc
      const { username, password, database } = readParamsFromContext();
      sql = connectAs({ username, password, database });
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
    ],
  };
};
