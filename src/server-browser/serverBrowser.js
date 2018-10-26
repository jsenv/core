import { open as serverOpen, createRequestPredicate, serviceCompose } from "../server/index.js"
import { open as serverCompileOpen } from "../server-compile/index.js"
import { createHTMLForBrowser } from "../createHTMLForBrowser.js"
import { guard } from "../guard.js"
import {
  getBrowserSystemRemoteURL,
  getBrowserPlatformRemoteURL,
} from "../compilePlatformAndSystem.js"
import { createBrowserPlatformSource, createBrowserExecuteSource } from "../createBrowserSource.js"

const getIndexPageHTML = ({ localRoot }) => {
  const files = ["src/__test__/file.js"]

  return `<!doctype html>

  <head>
    <title>Project root</title>
    <meta charset="utf-8" />
  </head>

  <body>
    <main>
			<h1>${localRoot}</h1>
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

export const open = ({
  protocol = "http",
  ip = "127.0.0.1",
  port = 3000,
  forcePort = true,

  localRoot,
  compileInto,
  compileService,
  groupMap,

  watch = false,
  watchPredicate,
  sourceCacheStrategy,
  sourceCacheIgnore,
}) => {
  // comme serverCompileOpen est cancellable on peut direct ecrire ca
  return serverCompileOpen({
    localRoot,
    compileInto,
    protocol, // reuse browser protocol
    compileService,
    watch,
    watchPredicate,
    sourceCacheStrategy,
    sourceCacheIgnore,
  }).then((server) => {
    // de sorte qu'ici si on cancel ce then ne doit pas sexecute

    const remoteRoot = server.origin
    console.log(`compiling ${localRoot} at ${remoteRoot}`)

    const indexRoute = guard(
      createRequestPredicate({
        ressource: "",
        method: "GET",
      }),
      () => {
        return Promise.resolve()
          .then(() =>
            getIndexPageHTML({
              localRoot,
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

    const otherRoute = guard(
      createRequestPredicate({
        ressource: "*",
        method: "GET",
      }),
      ({ ressource }) => {
        return Promise.resolve()
          .then(() => {
            return createHTMLForBrowser({
              scriptRemoteList: [
                { url: getBrowserSystemRemoteURL({ remoteRoot, compileInto }) },
                { url: getBrowserPlatformRemoteURL({ remoteRoot, compileInto }) },
              ],
              scriptInlineList: [
                {
                  source: createBrowserPlatformSource({
                    remoteRoot,
                    compileInto,
                    groupMap,
                    hotreload: watch,
                    hotreloadSSERoot: remoteRoot,
                  }),
                },
                {
                  source: createBrowserExecuteSource({
                    file: ressource,
                  }),
                },
              ],
            })
          })
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

    // mais s'il le fait il recup un autre cancellable de toute facon
    return serverOpen({
      protocol,
      ip,
      port,
      forcePort,
      requestToResponse: serviceCompose(indexRoute, otherRoute),
    }).then((runServer) => {
      console.log(`executing ${localRoot} at ${runServer.origin}`)
      return runServer
    })
  })
}
