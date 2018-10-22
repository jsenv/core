import { open as serverOpen, createRequestPredicate, serviceCompose } from "../server/index.js"
import { open as serverCompileOpen } from "../server-compile/index.js"
import { createHTMLForBrowser } from "../createHTMLForBrowser.js"
import { guard } from "../guard.js"

const getIndexPageHTML = ({ LOCAL_ROOT }) => {
  const files = ["src/__test__/file.js"]

  return `<!doctype html>

  <head>
    <title>Project root</title>
    <meta charset="utf-8" />
  </head>

  <body>
    <main>
			<h1>${LOCAL_ROOT}</h1>
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

export const open = ({
  LOCAL_ROOT,
  COMPILE_INTO,
  VARS,

  protocol = "http",
  ip = "127.0.0.1",
  port = 3000,
  forcePort = true,

  compileService,
  watch = false,
  watchPredicate,
  sourceCacheStrategy,
  sourceCacheIgnore,
}) => {
  return serverCompileOpen({
    LOCAL_ROOT,
    COMPILE_INTO,
    protocol, // reuse browser protocol
    compileService,
    watch,
    watchPredicate,
    sourceCacheStrategy,
    sourceCacheIgnore,
  }).then((server) => {
    console.log(`compiling ${LOCAL_ROOT} at ${server.origin}`)

    const indexRoute = guard(
      createRequestPredicate({
        ressource: "",
        method: "GET",
      }),
      () => {
        return Promise.resolve()
          .then(() => getIndexPageHTML({ LOCAL_ROOT }))
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
    )

    const otherRoute = guard(
      createRequestPredicate({
        ressource: "*",
        method: "GET",
      }),
      ({ ressource }) => {
        return Promise.resolve()
          .then(() =>
            getPageHTML({
              REMOTE_ROOT: server.origin,
              HOTRELOAD: watch,
              HOTRELOAD_SSE_ROOT: server.origin,
              FILE: ressource,
              ...VARS,
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
    )

    return serverOpen({
      protocol,
      ip,
      port,
      forcePort,
      requestToResponse: serviceCompose(indexRoute, otherRoute),
    }).then((runServer) => {
      console.log(`executing ${VARS.SOURCE_ROOT} at ${runServer.origin}`)
      return runServer
    })
  })
}
