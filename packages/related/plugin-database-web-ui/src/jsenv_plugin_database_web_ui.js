const htmlFileUrl = import.meta.resolve("./client/db_web_ui.html");

export const jsenvPluginDatabaseWebUI = () => {
  return {
    name: "jsenv:database_web_ui",

    devServerRoutes: [
      {
        endpoint: "GET /.internal/database/*",
        fetch: (request) => {},
      },
    ],
  };
};
