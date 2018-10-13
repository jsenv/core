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
    let allowReloadBecauseRejected = false

    if (hotreload) {
      var eventSource = new window.EventSource(remoteRoot, { withCredentials: true })
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
        if (
          allowReloadBecauseRejected ||
          window.System.get(changedFileLocation) ||
          failedImportFile === fileChanged
        ) {
          console.log(fileChanged, "modified, reloading")
          window.location.reload()
        }
      })
    }

    // `Error: yo
    // at Object.execute (http://127.0.0.1:57300/build/src/__test__/file-throw.js:9:13)
    // at doExec (http://127.0.0.1:3000/src/__test__/file-throw.js:452:38)
    // at postOrderExec (http://127.0.0.1:3000/src/__test__/file-throw.js:448:16)
    // at http://127.0.0.1:3000/src/__test__/file-throw.js:399:18`.replace(/(?:https?|ftp|file):\/\/(.*+)$/gm, (...args) => {
    //   debugger
    // })

    const link = (url, text = url) => `<a href="${url}">${text}</a>`

    const autoLink = (source) => {
      return source.replace(/(?:https?|ftp|file):\/\/.*?$/gm, (match) => {
        // remove lineNumber. columnNumber and possible last ) from url
        const url = match.replace(/(?::[0-9]+)?:[0-9]*\)?$/, "")
        // const sourceURL = url.replace(`${remoteRoot}/${remoteCompileDestination}`, remoteRoot)

        return link(url, match)
      })
    }

    window.System.import(remoteFile).catch((error) => {
      // we are missing a way to know which file has throw
      // it can be the one we import or a dependency
      // we could trust error.stack but ...
      // we could also change make systemjs tell us which module threw
      // the truth is that we should not be notified by the server
      // of file change that does not concern this module execution
      // so any file change will allow reload
      allowReloadBecauseRejected = true
      let data

      if (error && error.status === 500 && error.reason === "parse error") {
        const parseError = JSON.parse(error.body)
        // we know the file  responsible in case of parse error
        allowReloadBecauseRejected = false
        failedImportFile = parseError.fileName
        const message = parseError.message

        data = message.replace(
          failedImportFile,
          link(`${remoteRoot}/${failedImportFile}`, failedImportFile),
        )
      } else if (error && error instanceof Error) {
        data = autoLink(error.stack)
      } else {
        failedImportFile = file
        data = JSON.stringify(error)
      }

      document.body.innerHTML = `<h1><a href="${remoteRoot}/${file}">${file}</a> import rejected</h1>
      <pre style="border: 1px solid black">${data}</pre>`

      return Promise.reject(error)
    })
  }

  const source = `(${execute.toString()})("${remoteRoot}", "${remoteCompileDestination}", "${file}", ${hotreload})`
  // ${"//#"} sourceURL= ${remoteRoot}/${remoteCompileDestination}/${file}
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
                localRoot: root,
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
