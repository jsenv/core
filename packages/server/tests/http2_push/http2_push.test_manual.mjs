import { requestCertificateForLocalhost } from "@jsenv/https-local"

import { startServer, fetchFileSystem } from "@jsenv/server"

const { serverCertificate, serverCertificatePrivateKey } =
  await requestCertificateForLocalhost()
await startServer({
  logLevel: "info",
  protocol: "https",
  port: 3679,
  http2: true,
  privateKey: serverCertificatePrivateKey,
  certificate: serverCertificate,
  sendErrorDetails: true,
  requestToResponse: (request, { pushResponse }) => {
    if (request.ressource === "/main.html") {
      pushResponse({ path: "/script.js" })
      pushResponse({ path: "/style.css" })
    }

    return fetchFileSystem(
      new URL(request.ressource.slice(1), import.meta.url),
      {
        headers: request.headers,
        canReadDirectory: true,
      },
    )
  },
})
