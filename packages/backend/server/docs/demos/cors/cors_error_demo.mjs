import { startServer } from "@jsenv/server";

const server = await startServer({
  accessControlAllowRequestOrigin: true,
  accessControlAllowRequestMethod: true,
  accessControlAllowRequestHeaders: true,
  accessControlAllowCredentials: true,
  requestToResponse: () => {
    throw new Error("test");
  },
});

const response = await fetch(server.origin);
response.headers.has("access-control-allow-origin"); // true
