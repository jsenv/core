import { openCompileServer } from "../openCompileServer/openCompileServer.js"
import { openServer } from "../openServer/openServer.js"
import { createHTMLForBrowser } from "../createHTMLForBrowser.js"

const getClientScript = ({ compileURL, url }) => {
  const fileRelativeToRoot = url.pathname.slice(1)

  return `window.System.import("${compileURL}/${fileRelativeToRoot}")`
}

export const openBrowserServer = ({ root, port = 0 }) => {
  return openCompileServer({
    url: `http://127.0.0.1:0`,
    rootLocation: root,
  }).then((server) => {
    console.log(`compiling ${root} at ${server.url}`)
    return openServer({ url: `http://127.0.0.1:${port}` }).then((runServer) => {
      runServer.addRequestHandler((request) => {
        if (request.url.pathname === "/") {
          // on voudrait ptet servir du html
          // pour expliquer comment run les fichier etc
        }

        return createHTMLForBrowser({
          script: getClientScript({ compileURL: server.compileURL, url: request.url }),
        }).then((html) => {
          return {
            status: 200,
            headers: {
              "content-type": "text/html",
              "content-length": Buffer.byteLength(html),
              "cache-control": "no-store",
            },
            body: html,
          }
        })
      })

      console.log(`executing ${root} at ${runServer.url}`)

      return runServer
    })
  })
}
