const htmlFileUrl = import.meta.resolve("./client/database_explorer.html");

export const jsenvPluginDatabaseExplorer = () => {
  return {
    name: "jsenv:database_explorer",

    devServerRoutes: [
      {
        endpoint: "GET /.internal/database/*",
        fetch: (request) => {
          // we always want to return the db_web_ui.html SPA that will handle navigation and so on
          // the other API endpoints will be made to an other path like
          // /.internal/database/api/...
          // and we'll do things
        },
      },
    ],
  };
};
