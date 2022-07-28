import { requestCertificateForLocalhost } from "@jsenv/https-local"

import {
  startServer,
  fetchFileSystem,
  jsenvServiceCORS,
  jsenvServiceErrorHandler,
  jsenvAccessControlAllowedHeaders,
} from "@jsenv/server"

const { certificate, privateKey } = requestCertificateForLocalhost()
await startServer({
  logLevel: "info",
  protocol: "https",
  port: 3679,
  http2: true,
  privateKey,
  certificate,
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
    {
      handleRequest: (request, { pushResponse }) => {
        if (request.ressource === "/main.html") {
          pushResponse({ path: "/script.js" })
          pushResponse({ path: "/style.css" })
        }
        return fetchFileSystem(
          new URL(request.ressource.slice(1), new URL("./", import.meta.url)),
          {
            headers: request.headers,
            rootDirectoryUrl: new URL("./", import.meta.url),
            canReadDirectory: true,
            mtimeEnabled: true,
          },
        )
      },
    },
  ],
})
