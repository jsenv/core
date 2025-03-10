import {
  createFileSystemFetch,
  jsenvServiceCORS,
  startServer,
} from "@jsenv/server";

const serverDirectoryUrl = new URL("./client/", import.meta.url);

export const localServer = await startServer({
  logLevel: "warn",
  hostname: "127.0.0.1",
  port: 9999,
  keepProcessAlive: false,
  services: [
    jsenvServiceCORS({
      accessControlAllowRequestOrigin: true,
      accessControlAllowRequestMethod: true,
      accessControlAllowRequestHeaders: true,
      accessControlAllowCredentials: true,
    }),
  ],
  routes: [
    {
      endpoint: "GET *",
      fetch: createFileSystemFetch(serverDirectoryUrl),
    },
  ],
});
