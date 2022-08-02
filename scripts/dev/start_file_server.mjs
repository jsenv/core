import { startServer, fetchFileSystem } from "@jsenv/server"
import { requestCertificate } from "@jsenv/https-local"

const { certificate, privateKey } = requestCertificate({ altNames: ["local"] })
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
          new URL(request.resource.slice(1), directoryUrl),
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
