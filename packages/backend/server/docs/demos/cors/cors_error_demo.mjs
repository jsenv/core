import {
  serverPluginCORS,
  serverPluginErrorHandler,
  startServer,
} from "@jsenv/server";

const server = await startServer({
  plugins: [
    serverPluginErrorHandler(),
    serverPluginCORS({
      accessControlAllowRequestOrigin: true,
      accessControlAllowRequestMethod: true,
      accessControlAllowRequestHeaders: true,
      accessControlAllowCredentials: true,
    }),
  ],
  routes: [
    {
      endpoint: "GET *",
      fetch: () => {
        throw new Error("test");
      },
    },
  ],
});

const response = await fetch(server.origin);
console.log(response.status); // 500
console.log(response.headers.has("access-control-allow-origin")); // true
