import {
  urlToPathname,
  urlToExtension,
  urlIsInsideOf,
  ensurePathnameTrailingSlash,
} from "@jsenv/urls";
import { readParamsFromContext, connectAs } from "@jsenv/database";

const databaseExplorerHtmlFileUrl = import.meta.resolve(
  "./client/database_explorer.html",
);

export const jsenvPluginDatabaseExplorer = () => {
  let databaseExplorerRootDirectoryUrl;
  let sql;

  return {
    name: "jsenv:database_explorer",
    init: async ({ rootDirectoryUrl }) => {
      const { username, password, database } = readParamsFromContext();
      sql = connectAs({ username, password, database });
      databaseExplorerRootDirectoryUrl = new URL(
        "./.internal/database/",
        rootDirectoryUrl,
      ).href;
    },
    redirectReference: (reference) => {
      if (
        ensurePathnameTrailingSlash(reference.url) ===
        databaseExplorerRootDirectoryUrl
      ) {
        return databaseExplorerHtmlFileUrl;
      }
      if (
        urlIsInsideOf(reference.url, databaseExplorerRootDirectoryUrl) &&
        !urlToExtension(reference.url) &&
        !urlToPathname(reference.url).endsWith("/")
      ) {
        return databaseExplorerHtmlFileUrl;
      }
      return null;
    },

    devServerRoutes: [
      {
        endpoint: "GET /.internal/database",
        description: "Explore and manage database using a Web interface",
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
          const publicFilter = request.searchParams.has("public");
          const results = await sql`
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
          return Response.json(results);
        },
      },
    ],
  };
};
