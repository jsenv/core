import { openCompileServer } from "../openCompileServer/openCompileServer.js"
import { openServer } from "../openServer/openServer.js"
import { createHTMLForBrowser } from "../createHTMLForBrowser.js"
import { createResponseGenerator } from "../openServer/createResponseGenerator.js"

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

const getPageHTML = ({ compileServerURL, compileURL, url }) => {
  const serverRoot = compileServerURL.toString().slice(0, -1)
  const fileRelativeToRoot = url.pathname.slice(1)
  const fileLocation = `${compileURL}/${fileRelativeToRoot}`

  const script = `
var eventSource = new EventSource("${serverRoot}", { withCredentials: true })
eventSource.addEventListener("file-changed", (e) => {
	if (e.origin !== "${serverRoot}") {
		return
	}
	var fileChanged = e.data
	var changedFileLocation = "${compileURL}/" + fileChanged
	// we cmay be notified from file we don't care about, reload only if needed
	// we cannot just System.delete the file because the change may have any impact, we have to reload
	if (System.get(changedFileLocation)) {
		console.log(fileChanged, 'modified, reloading')
		window.location.reload()
  }
})

window.System.import("${fileLocation}")
`

  return createHTMLForBrowser({
    script,
  })
}

const createRoute = ({ method, path = "*", handler }) => {
  const regexp = new RegExp(`^${path.replace(/\*/g, ".*?")}$`)
  const matchPath = (requestPathname) => {
    return regexp.test(requestPathname)
  }

  const lowserCaseMethod = method.toLowerCase()
  const matchMethod = (requestMethod) => {
    if (lowserCaseMethod === "*") {
      return true
    }
    return requestMethod.toLowerCase() === lowserCaseMethod
  }

  return (request) => {
    if (matchMethod(request.method) === false) {
      return false
    }
    if (matchPath(request.url.pathname) === false) {
      return false
    }
    return handler(request)
  }
}

export const openBrowserServer = ({ root, port = 3000, forcePort = true }) => {
  return openCompileServer({
    url: `http://127.0.0.1:0`,
    rootLocation: root,
    watch: true,
  }).then((server) => {
    console.log(`compiling ${root} at ${server.url}`)
    return openServer({ url: `http://127.0.0.1:${port}`, forcePort }).then((runServer) => {
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
              getPageHTML({ compileServerURL: server.url, compileURL: server.compileURL, url }),
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

      runServer.addRequestHandler(createResponseGenerator(indexRoute, otherRoute))

      console.log(`executing ${root} at ${runServer.url}`)

      return runServer
    })
  })
}
