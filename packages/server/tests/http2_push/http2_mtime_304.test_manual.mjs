import { requestCertificateForLocalhost } from "@jsenv/https-local"

import { startServer, fetchFileSystem } from "@jsenv/server"

const { certificate, privateKey } = requestCertificateForLocalhost()
await startServer({
  logLevel: "info",
  protocol: "https",
  http2: true,
  port: 3679,
  privateKey,
  certificate,
  services: [
    {
      handleRequest: (request, { pushResponse }) => {
        if (request.ressource === "/main.html") {
          pushResponse({ path: "/script.js" })
          pushResponse({ path: "/style.css" })
        }
        return fetchFileSystem(
          new URL(request.ressource.slice(1), import.meta.url),
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
