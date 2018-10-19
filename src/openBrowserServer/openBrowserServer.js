import { openServer, createRoute, serviceCompose } from "../openServer/index.js"
import { createHTMLForBrowser } from "../createHTMLForBrowser.js"
import { openCompileServer } from "../openCompileServer/index.js"

const getIndexPageHTML = ({ root, files = [] }) => {
  return `<!doctype html>

  <head>
    <title>Project root</title>
    <meta charset="utf-8" />
  </head>

  <body>
    <main>
			<h1>${root}</h1>
			<p>Sample file to execute: </p>
			<ul>
				${files
          .map((file) => {
            return `<li><a href="/${file}">${file}</a></li>`
          })
          .join("")}
			</ul>
    </main>
  </body>

  </html>`
}

const getClientScript = () => {}

const getPageHTML = (options) => {
  return createHTMLForBrowser({
    script: getClientScript(options),
  })
}

export const openBrowserServer = ({
  protocol = "http",
  ip = "127.0.0.1",
  port = 3000,
  forcePort = true,
  watch = false,

  root,
  into,
  compileService,
  getCompileIdSource,
  ...rest
}) => {
  return openCompileServer({
    root,
    into,
    watch,
    protocol, // if not specified, reuse browser protocol
    compileService,
    ...rest,
  }).then((server) => {
    console.log(`compiling ${root} at ${server.origin}`)

    const indexRoute = createRoute({
      ressource: "",
      method: "GET",
      handler: () => {
        return Promise.resolve()
          .then(() => getIndexPageHTML({ root, files: ["src/__test__/file.js"] }))
          .then((html) => {
            return {
              status: 200,
              headers: {
                "cache-control": "no-store",
                "content-type": "text/html",
                "content-length": Buffer.byteLength(html),
              },
              body: html,
            }
          })
      },
    })

    const otherRoute = createRoute({
      ressource: "*",
      method: "GET",
      handler: ({ ressource }) => {
        return Promise.resolve()
          .then(() =>
            getPageHTML({
              localRoot: root,
              remoteRoot: server.origin,
              remoteCompileDestination: into,
              file: ressource,
              hotreload: watch,
              getCompileIdSource,
            }),
          )
          .then((html) => {
            return {
              status: 200,
              headers: {
                "cache-control": "no-store",
                "content-type": "text/html",
                "content-length": Buffer.byteLength(html),
              },
              body: html,
            }
          })
      },
    })

    return openServer({
      protocol,
      ip,
      port,
      forcePort,
      requestToResponse: serviceCompose(indexRoute, otherRoute),
    }).then((runServer) => {
      console.log(`executing ${root} at ${runServer.origin}`)
      return runServer
    })
  })
}
