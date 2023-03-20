import { requestCertificate } from "@jsenv/https-local"

import {
  startServer,
  fetchFileSystem,
  jsenvServiceErrorHandler,
} from "@jsenv/server"

const { certificate, privateKey } = requestCertificate()
await startServer({
  logLevel: "info",
  port: 3679,
  http2: true,
  https: { certificate, privateKey },
  services: [
    {
      handleRequest: (request, { pushResponse }) => {
        if (request.pathname === "/main.html") {
          pushResponse({ path: "/script.js" })
          pushResponse({ path: "/style.css" })
        }

        return fetchFileSystem(
          new URL(request.resource.slice(1), import.meta.url),
          {
            headers: request.headers,
            canReadDirectory: true,
          },
        )
      },
    },
    jsenvServiceErrorHandler({ sendErrorDetails: true }),
  ],
})
