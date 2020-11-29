import { resolveUrl, readFile, writeFile } from "@jsenv/util"
import { startServer, serveFile, firstService } from "@jsenv/server"

const directoryUrl = resolveUrl("./app/", import.meta.url)

startServer({
  protocol: "https",
  port: 3689,
  requestToResponse: firstService(
    async (request) => {
      if (request.ressource !== "/actions/update-manifest") return null

      const serviceWorkerFileUrl = resolveUrl("./pwa.service-worker.js", directoryUrl)
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
      if (request.ressource !== "/actions/update-style") return null

      const styleFileUrl = resolveUrl("./pwa.style.css", directoryUrl)
      const styleFileContent = await readFile(styleFileUrl)
      await writeFile(
        styleFileUrl,
        `${styleFileContent}
/* toto */`,
      )

      return { status: 200 }
    },
    (request) => {
      let { ressource } = request
      if (ressource === "/") {
        ressource = "/pwa.main.html"
      }
      const requestUrl = resolveUrl(ressource.slice(1), directoryUrl)
      return serveFile(requestUrl, {
        ...request,
        canReadDirectory: true,
      })
    },
  ),
})
