import { requestCertificate } from "@jsenv/https-local";
import {
  createFileSystemFetch,
  jsenvAccessControlAllowedHeaders,
  serverPluginCORS,
  serverPluginErrorHandler,
  startServer,
} from "@jsenv/server";

const { certificate, privateKey } = requestCertificate();
await startServer({
  logLevel: "info",
  port: 3679,
  https: { certificate, privateKey },
  http2: true,
  serverTiming: true,
  plugins: [
    serverPluginCORS({
      accessControlAllowRequestOrigin: true,
      accessControlAllowRequestMethod: true,
      accessControlAllowRequestHeaders: true,
      accessControlAllowedRequestHeaders: [
        ...jsenvAccessControlAllowedHeaders,
        "x-jsenv-execution-id",
      ],
      accessControlAllowCredentials: true,
    }),
    serverPluginErrorHandler({
      sendErrorDetails: true,
    }),
  ],
  routes: [
    {
      endpoint: "GET *",
      fetch: (request, helpers) => {
        if (request.pathname === "/main.html") {
          helpers.pushResponse({ path: "/script.js" });
          helpers.pushResponse({ path: "/style.css" });
        }
        return createFileSystemFetch(import.meta.resolve("./"), {
          canReadDirectory: true,
          mtimeEnabled: true,
        })(request, helpers);
      },
    },
  ],
});
