export const devServerPluginInjectServerResponseHeader = ({
  sourceDirectoryUrl,
}) => {
  return {
    name: "jsenv:jsenv_inject_server_response_header",
    routes: [
      {
        endpoint: "GET /.internal/server.json",
        description: "Get information about jsenv dev server",
        availableMediaTypes: ["application/json"],
        declarationSource: import.meta.url,
        fetch: () =>
          Response.json({
            server: "jsenv_dev_server/1",
            sourceDirectoryUrl,
          }),
      },
    ],
    injectResponseProperties: () => {
      return {
        headers: {
          server: "jsenv_dev_server/1",
        },
      };
    },
  };
};
