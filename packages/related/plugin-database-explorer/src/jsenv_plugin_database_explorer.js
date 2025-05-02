import { urlToPathname, urlToExtension, urlIsInsideOf } from "@jsenv/urls";

const databaseExplorerHtmlFileUrl = import.meta.resolve(
  "./client/database_explorer.html",
);

export const jsenvPluginDatabaseExplorer = () => {
  let databaseExplorerRootDirectoryUrl;

  return {
    name: "jsenv:database_explorer",
    init: ({ rootDirectoryUrl }) => {
      databaseExplorerRootDirectoryUrl = new URL(
        "./.internal/database/",
        rootDirectoryUrl,
      ).href;
    },
    redirectReference: (reference) => {
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
        fetch: () => {
          // TODO: get the list of tables
        },
      },
    ],
  };
};
