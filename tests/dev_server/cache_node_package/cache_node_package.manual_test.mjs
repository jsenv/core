import { startDevServer } from "@jsenv/core";

await startDevServer({
  logLevel: "info",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  sourceMainFilePath: "main.html",
  services: [
    {
      name: "spy_request",
      handleRequest: (request) => {
        console.log("requested for", request.resource);
      },
    },
  ],
  port: 5433,
  ribbon: false,
  clientAutoreload: false,
  supervisor: false,
});
