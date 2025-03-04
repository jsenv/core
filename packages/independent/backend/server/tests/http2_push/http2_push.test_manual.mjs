import { requestCertificate } from "@jsenv/https-local";
import {
  createFileSystemRequestHandler,
  jsenvServiceErrorHandler,
  startServer,
} from "@jsenv/server";

const { certificate, privateKey } = requestCertificate();
await startServer({
  logLevel: "info",
  port: 3679,
  http2: true,
  https: { certificate, privateKey },
  services: [
    {
      handleRequest: (request, helpers) => {
        if (request.pathname === "/main.html") {
          helpers.pushResponse({ path: "/script.js" });
          helpers.pushResponse({ path: "/style.css" });
        }
        return createFileSystemRequestHandler(import.meta.resolve("./"), {
          canReadDirectory: true,
        })(request, helpers);
      },
    },
    jsenvServiceErrorHandler({ sendErrorDetails: true }),
  ],
});
