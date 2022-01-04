import { requestCertificateForLocalhost } from "@jsenv/https-local"
import { resolveUrl } from "@jsenv/filesystem"
import { startServer, fetchFileSystem } from "@jsenv/server"

const { serverCertificate, serverCertificatePrivateKey } =
  await requestCertificateForLocalhost({
    serverCertificateAltNames: ["local"],
  })

const directoryUrl = resolveUrl("../../", import.meta.url)

await startServer({
  protocol: "https",
  port: 3689,
  privateKey: serverCertificatePrivateKey,
  certificate: serverCertificate,
  requestToResponse: (request) => {
    return fetchFileSystem(new URL(request.ressource.slice(1), directoryUrl), {
      headers: request.headers,
      canReadDirectory: true,
    })
  },
})
