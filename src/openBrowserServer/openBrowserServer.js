import { openServer, createRoute, serviceCompose } from "../openServer/index.js"
import { createHTMLForBrowser } from "../createHTMLForBrowser.js"
import { convertFunctionAndArgumentsToSource } from "../convertFunctionAndArgumentsToSource.js"
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

// au lieu de ca on pourrait rollup un truc custom pour le browser
const getClientScript = ({
  remoteRoot,
  remoteCompileDestination,
  file,
  hotreload,
  getCompileIdSource,
}) => {
  return convertFunctionAndArgumentsToSource(
    (getCompileIdSource, remoteRoot, remoteCompileDestination, file, hotreload) => {
      return Promise.resolve()
        .then(() => eval(getCompileIdSource))
        .then((getCompileId) => getCompileId())
        .then((compileId) => {
          const remoteFile = `${remoteRoot}/${remoteCompileDestination}/${compileId}/${file}`

          let failedImportFile

          const link = (url, text = url) => `<a href="${url}">${text}</a>`

          // `Error: yo
          // at Object.execute (http://127.0.0.1:57300/build/src/__test__/file-throw.js:9:13)
          // at doExec (http://127.0.0.1:3000/src/__test__/file-throw.js:452:38)
          // at postOrderExec (http://127.0.0.1:3000/src/__test__/file-throw.js:448:16)
          // at http://127.0.0.1:3000/src/__test__/file-throw.js:399:18`.replace(/(?:https?|ftp|file):\/\/(.*+)$/gm, (...args) => {
          //   debugger
          // })
          const autoLink = (source) => {
            return source.replace(/(?:https?|ftp|file):\/\/.*?$/gm, (match) => {
              // remove lineNumber. columnNumber and possible last ) from url
              const url = match.replace(/(?::[0-9]+)?:[0-9]*\)?$/, "")
              // const sourceURL = url.replace(`${remoteRoot}/${remoteCompileDestination}`, remoteRoot)

              return link(url, match)
            })
          }

          const getErrorMeta = (error) => {
            if (error && error.status === 500 && error.reason === "parse error") {
              const parseError = JSON.parse(error.body)
              const file = parseError.fileName
              const message = parseError.message
              const data = message.replace(
                file,
                link(`${remoteRoot}/${failedImportFile}`, failedImportFile),
              )

              return {
                file,
                data,
              }
            }

            if (error && error.code === "MODULE_INSTANTIATE_ERROR") {
              const file = error.url.slice(`${remoteRoot}/${remoteCompileDestination}`.length) // to be tested
              const originalError = error.error
              return {
                file,
                data:
                  originalError && originalError instanceof Error
                    ? autoLink(originalError.stack)
                    : JSON.stringify(originalError),
              }
            }

            return {
              data: error && error instanceof Error ? autoLink(error.stack) : JSON.stringify(error),
            }
          }

          if (hotreload) {
            const eventSource = new window.EventSource(remoteRoot, { withCredentials: true })
            eventSource.onerror = () => {
              // we could try to reconnect several times before giving up
              // but dont keep it open as it would try to reconnect forever
              eventSource.close()
            }
            eventSource.addEventListener("file-changed", (e) => {
              if (e.origin !== remoteRoot) {
                return
              }
              const fileChanged = e.data
              const changedFileLocation = `${remoteRoot}/${remoteCompileDestination}/${fileChanged}`
              // we cmay be notified from file we don't care about, reload only if needed
              // we cannot just System.delete the file because the change may have any impact, we have to reload
              if (failedImportFile === fileChanged || window.System.get(changedFileLocation)) {
                window.location.reload()
              }
            })
          }

          window.System.import(remoteFile).catch((error) => {
            const meta = getErrorMeta(error)
            failedImportFile = meta.file

            document.body.innerHTML = `<h1><a href="${remoteRoot}/${file}">${file}</a> import rejected</h1>
			<pre style="border: 1px solid black">${meta.data}</pre>`

            return Promise.reject(error)
          })
        })
    },
    [getCompileIdSource, remoteRoot, remoteCompileDestination, file, hotreload],
  )
}

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
