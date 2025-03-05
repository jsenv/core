import { requestCertificate } from "@jsenv/https-local";
import {
  createFileSystemFetch,
  jsenvAccessControlAllowedHeaders,
  jsenvServiceCORS,
  jsenvServiceErrorHandler,
  startServer,
} from "@jsenv/server";

const { certificate, privateKey } = requestCertificate();
await startServer({
  logLevel: "info",
  port: 3679,
  https: { certificate, privateKey },
  http2: true,
  serverTiming: true,
  services: [
    jsenvServiceCORS({
      accessControlAllowRequestOrigin: true,
      accessControlAllowRequestMethod: true,
      accessControlAllowRequestHeaders: true,
      accessControlAllowedRequestHeaders: [
        ...jsenvAccessControlAllowedHeaders,
        "x-jsenv-execution-id",
      ],
      accessControlAllowCredentials: true,
    }),
    jsenvServiceErrorHandler({
      sendErrorDetails: true,
    }),
  ],
  routes: [
    {
      endpoint: "GET *",
      response: (request, helpers) => {
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
