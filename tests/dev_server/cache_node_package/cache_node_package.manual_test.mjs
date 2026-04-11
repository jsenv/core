import { startDevServer } from "@jsenv/core";

await startDevServer({
  logLevel: "info",
  sourceDirectoryUrl: import.meta.resolve("./client/"),
  sourceMainFilePath: "main.html",
  plugins: [
    {
      name: "spy_request",
      routes: [
        {
          endpoint: "GET *",
          fetch: (request) => {
            console.log("requested for", request.resource);
          },
        },
      ],
    },
  ],
  port: 5433,
  ribbon: false,
  clientAutoreload: false,
  clientAutoreloadOnServerRestart: false,
  supervisor: false,
  dropToOpen: false,
});
