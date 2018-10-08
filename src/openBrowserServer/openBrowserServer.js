import { openCompileServer } from "../openCompileServer/openCompileServer.js"
import { openServer } from "../openServer/openServer.js"
import { createHTMLForBrowser } from "../createHTMLForBrowser.js"
import { createResponseGenerator } from "../openServer/createResponseGenerator.js"

const getClientScript = ({ compileURL, url }) => {
  const fileRelativeToRoot = url.pathname.slice(1)

  return `window.System.import("${compileURL}/${fileRelativeToRoot}")`
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
  }).then((server) => {
    console.log(`compiling ${root} at ${server.url}`)
    return openServer({ url: `http://127.0.0.1:${port}`, forcePort }).then((runServer) => {
      const indexRoute = createRoute({
        method: "GET",
        path: "/",
        handler: () => {
          const body = `<!doctype html>

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

          return {
            status: 200,
            headers: {
              "cache-control": "no-store",
              "content-type": "text/html",
              "content-length": Buffer.byteLength(body),
            },
            body,
          }
        },
      })

      const otherRoute = createRoute({
        method: "GET",
        path: "*",
        handler: ({ url }) => {
          return createHTMLForBrowser({
            script: getClientScript({ compileURL: server.compileURL, url }),
          }).then((html) => {
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
