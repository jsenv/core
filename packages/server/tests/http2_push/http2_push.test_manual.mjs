import { requestCertificate } from "@jsenv/https-local"

import { startServer, fetchFileSystem } from "@jsenv/server"

const { certificate, privateKey } = requestCertificate()
await startServer({
  logLevel: "info",
  protocol: "https",
  port: 3679,
  http2: true,
  privateKey,
  certificate,
  sendErrorDetails: true,
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
  ],
})
