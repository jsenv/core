import { openCompileServer } from "../openCompileServer/openCompileServer.js"
import { createPredicateFromStructure } from "../openCompileServer/createPredicateFromStructure.js"
import { openServer, createRoute, createResponseGenerator } from "../openServer/index.js"
import { createHTMLForBrowser } from "../createHTMLForBrowser.js"

const getIndexPageHTML = ({ root }) => {
  return `<!doctype html>

  <head>
    <title>${root}</title>
    <meta charset="utf-8" />
  </head>

  <body>
    <main>
      This is the root your project: ${root} <br />
      You can execute file by navigating like <a href="./src/__test__/file.js">src/__test__/file.js</a>
    </main>
  </body>

  </html>`
}

const getClientScript = ({ remoteRoot, remoteCompileDestination, file, hotreload }) => {
  const execute = (remoteRoot, remoteCompileDestination, file, hotreload) => {
    const remoteFile = `${remoteRoot}/${remoteCompileDestination}/${file}`
    let failedImportFile

    if (hotreload) {
      var eventSource = new window.EventSource(remoteRoot, { withCredentials: true })
      eventSource.addEventListener("file-changed", (e) => {
        if (e.origin !== remoteRoot) {
          return
        }
        const fileChanged = e.data
        const changedFileLocation = `${remoteRoot}/${remoteCompileDestination}/${fileChanged}`
        // we cmay be notified from file we don't care about, reload only if needed
        // we cannot just System.delete the file because the change may have any impact, we have to reload
        if (window.System.get(changedFileLocation) || failedImportFile === fileChanged) {
          console.log(fileChanged, "modified, reloading")
          window.location.reload()
        }
      })
    }

    window.System.import(remoteFile).catch((error) => {
      if (error && error.status === 500 && error.reason === "parse error") {
        const parseError = JSON.parse(error.body)
        failedImportFile = parseError.fileName
        document.body.innerHTML = `<h1>
          ${parseError.name} at <a href="${remoteRoot}/${parseError.fileName}">${
          parseError.fileName
        }</a>
        </h1>
        <pre style="border: 1px solid black">${parseError.message}</pre>`
      }
      return Promise.reject(error)
    })
  }

  const source = `(${execute.toString()})("${remoteRoot}", "${remoteCompileDestination}", "${file}", ${hotreload})`
  return source
}

const getPageHTML = (options) => {
  return createHTMLForBrowser({
    script: getClientScript(options),
  })
}

export const openBrowserServer = ({
  root,
  into,
  port = 3000,
  forcePort = true,
  watch = false,
  ...rest
}) => {
  return createPredicateFromStructure({ root }).then(({ instrumentPredicate, watchPredicate }) => {
    return openCompileServer({
      root,
      into,
      url: `http://127.0.0.1:0`,
      instrumentPredicate,
      watch,
      watchPredicate,
      ...rest,
    }).then((server) => {
      console.log(`compiling ${root} at ${server.url}`)

      const indexRoute = createRoute({
        method: "GET",
        path: "/",
        handler: () => {
          return Promise.resolve()
            .then(() => getIndexPageHTML({ root }))
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
        method: "GET",
        path: "*",
        handler: ({ url }) => {
          return Promise.resolve()
            .then(() =>
              getPageHTML({
                remoteRoot: server.url.toString().slice(0, -1),
                remoteCompileDestination: into,
                file: url.pathname.slice(1),
                hotreload: watch,
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
        url: `http://127.0.0.1:${port}`,
        forcePort,
        getResponseForRequest: createResponseGenerator(indexRoute, otherRoute),
      }).then((runServer) => {
        console.log(`executing ${root} at ${runServer.url}`)
        return runServer
      })
    })
  })
}
