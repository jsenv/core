import { resolveUrl, readFile, writeFile } from "@jsenv/util"
import { startServer, serveFile, firstService, readRequestBodyAsString } from "@jsenv/server"

const directoryUrl = resolveUrl("./app/dist/", import.meta.url)

startServer({
  protocol: "https",
  port: 3689,
  requestToResponse: firstService(
    async (request) => {
      if (request.ressource !== "/actions/update-manifest") return null

      const serviceWorkerFileUrl = resolveUrl("./sw.js", directoryUrl)
      const serviceWorkerFileContent = await readFile(serviceWorkerFileUrl)
      await writeFile(
        serviceWorkerFileUrl,
        `${serviceWorkerFileContent}
// toto`,
      )

      return {
        status: 200,
      }
    },
    async (request) => {
      if (request.ressource !== "/actions/update-file") return null

      const fileContent = await readRequestBodyAsString(request.body)
      const fileUrl = resolveUrl("./file.txt", directoryUrl)
      await writeFile(fileUrl, fileContent)

      return { status: 200 }
    },
    (request) => {
      let { ressource } = request
      if (ressource === "/") {
        ressource = "/main.html"
      }
      return serveFile(request, {
        rootDirectoryUrl: directoryUrl,
        canReadDirectory: true,
      })
    },
  ),
})
