import { open as serverOpen, createRequestPredicate, serviceCompose } from "../server/index.js"
import { open as serverCompileOpen } from "../server-compile/index.js"
import { createHTMLForBrowser } from "../createHTMLForBrowser.js"
import { guard } from "../guard.js"
import { uneval } from "@dmail/uneval"
import {
  getBrowserSystemLocalURL,
  getBrowserPlatformLocalURL,
  compilePlatformAndSystem,
  getBrowserSystemRemoteURL,
  getBrowserPlatformRemoteURL,
} from "./compilePlatformAndSystem.js"

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

const getClientScript = ({
  remoteRoot,
  compileInto,
  groupMap,
  groupMapDefaultId,
  hotreload,
  hotreloadSSERoot,
  file,
}) => {
  return `
  window.__platform__ = window.__browserPlatform__.createBrowserPlatform({
    remoteRoot: ${uneval(remoteRoot)},
    compileInto: ${uneval(compileInto)},
    groupMap: ${uneval(groupMap)},
    groupMapDefaultId: ${uneval(groupMapDefaultId)},
    hotreload: ${uneval(hotreload)},
    hotreloadSSERoot: ${uneval(hotreloadSSERoot)},
    hotreloadCallback: function() {
      // we cannot just System.delete the file because the change may have any impact, we have to reload
      window.location.reload()
    }
  })
  window.__platform__.executeFile(${uneval(file)})
`
}

export const open = ({
  localRoot,
  compileInto,
  groupMap,
  groupMapDefaultId,

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
  return compilePlatformAndSystem({
    browserSystemLocalURL: getBrowserSystemLocalURL({ localRoot, compileInto }),
    browserPlatformLocalURL: getBrowserPlatformLocalURL({ localRoot, compileInto }),
  }).then(() => {
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
                    source: getClientScript({
                      localRoot,
                      remoteRoot,
                      compileInto,
                      groupMap,
                      groupMapDefaultId,
                      hotreload: watch,
                      hotreloadSSERoot: remoteRoot,
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
  })
}
