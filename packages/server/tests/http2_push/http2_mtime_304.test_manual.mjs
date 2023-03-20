import { requestCertificate } from "@jsenv/https-local"

import { startServer, fetchFileSystem } from "@jsenv/server"

const { certificate, privateKey } = requestCertificate()
await startServer({
  logLevel: "info",
  https: { certificate, privateKey },
  http2: true,
  port: 3679,
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
            mtimeEnabled: true,
          },
        )
      },
    },
  ],
})
