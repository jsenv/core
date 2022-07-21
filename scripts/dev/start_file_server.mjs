import { startServer, fetchFileSystem } from "@jsenv/server"
import { requestCertificateForLocalhost } from "@jsenv/https-local"

const { certificate, privateKey } = requestCertificateForLocalhost({
  altNames: ["local"],
})
const directoryUrl = new URL("../../", import.meta.url).href
await startServer({
  protocol: "https",
  port: 3689,
  privateKey,
  certificate,
  services: [
    {
      handleRequest: (request) => {
        return fetchFileSystem(
          new URL(request.ressource.slice(1), directoryUrl),
          {
            rootDirectoryUrl: directoryUrl,
            headers: request.headers,
            canReadDirectory: true,
          },
        )
      },
    },
  ],
})
