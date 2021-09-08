import { resolveUrl, readFile, writeFile } from "@jsenv/filesystem"
import { startServer, serveFile, composeServices, readRequestBody } from "@jsenv/server"

const directoryUrl = resolveUrl("./app/dist/", import.meta.url)

startServer({
  protocol: "http",
  port: 3689,
  requestToResponse: composeServices(
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

      const fileContent = await readRequestBody(request.body)
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
