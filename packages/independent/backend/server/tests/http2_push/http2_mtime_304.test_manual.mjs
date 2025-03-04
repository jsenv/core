import { requestCertificate } from "@jsenv/https-local";
import { createFileSystemRequestHandler, startServer } from "@jsenv/server";

const { certificate, privateKey } = requestCertificate();
await startServer({
  logLevel: "info",
  https: { certificate, privateKey },
  http2: true,
  port: 3679,
  services: [
    {
      handleRequest: (request, helpers) => {
        if (request.pathname === "/main.html") {
          helpers.pushResponse({ path: "/script.js" });
          helpers.pushResponse({ path: "/style.css" });
        }
        return createFileSystemRequestHandler(import.meta.resolve("./"), {
          canReadDirectory: true,
          mtimeEnabled: true,
        })(request, helpers);
      },
    },
  ],
});
