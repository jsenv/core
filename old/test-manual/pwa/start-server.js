import { resolveUrl, readFile, writeFile } from "@jsenv/filesystem"
import {
  startServer,
  fetchFileSystem,
  composeServices,
  readRequestBody,
} from "@jsenv/server"

const directoryUrl = resolveUrl("./app/dist/", import.meta.url)

startServer({
  protocol: "http",
  port: 3689,
  requestToResponse: composeServices({
    update_manifest: async (request) => {
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
    update_file: async (request) => {
      if (request.ressource !== "/actions/update-file") return null

      const fileContent = await readRequestBody(request.body)
      const fileUrl = resolveUrl("./file.txt", directoryUrl)
      await writeFile(fileUrl, fileContent)

      return { status: 200 }
    },
    static: (request) => {
      let { ressource } = request
      if (ressource === "/") {
        ressource = "/main.html"
      }
      return fetchFileSystem(
        new URL(request.ressource.slice(1), directoryUrl),
        {
          headers: request.headers,
          canReadDirectory: true,
        },
      )
    },
  }),
})
