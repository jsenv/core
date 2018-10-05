import { openCompileServer } from "../openCompileServer/openCompileServer.js"
import { openServer } from "../openServer/openServer.js"
import { createHTMLForBrowser } from "../createHTMLForBrowser.js"

const getClientScript = ({ compileURL, url }) => {
  const fileRelativeToRoot = url.pathname.slice(1)

  return `window.System.import("${compileURL}/${fileRelativeToRoot}")`
}

export const openBrowserServer = ({ root, port = 3000, forcePort = true }) => {
  return openCompileServer({
    url: `http://127.0.0.1:0`,
    rootLocation: root,
  }).then((server) => {
    console.log(`compiling ${root} at ${server.url}`)
    return openServer({ url: `http://127.0.0.1:${port}`, forcePort }).then((runServer) => {
      runServer.addRequestHandler((request) => {
        if (request.url.pathname === "/") {
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
              "content-type": "text/html",
              "content-length": Buffer.byteLength(body),
              "cache-control": "no-store",
            },
            body,
          }
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
