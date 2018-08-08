#!/usr/bin/env node

import { openCompileServer } from "../src/openCompileServer/openCompileServer.js"
import { openServer } from "../src/openServer/openServer.js"
import fs from "fs"
import net from "net"
import { URL } from "url"

const readCache = () => {
  return Promise.resolve({})
  // return new Promise((resolve, reject) => {
  //   fs.readFile(".cache.json", (error, json) => {
  //     if (error) {
  //       if (error.code === "ENOENT") {
  //         return resolve({})
  //       }
  //       return reject(error)
  //     }
  //     return resolve(JSON.parse(json.toString()))
  //   })
  // })
}

const writeCache = (data) => {
  return new Promise((resolve, reject) => {
    fs.writeFile(".cache.json", JSON.stringify(data, null, "  "), (error) => {
      if (error) {
        return reject(error)
      }
      return resolve()
    })
  })
}

const portIsUsed = (port, host) => {
  return new Promise((resolve, reject) => {
    const server = net.createServer().listen(port, host)
    server.once("listening", () => {
      server.close(() => {
        resolve(false)
      })
    })
    server.once("error", (error) => {
      if (error && error.code === "EADDRINUSE") {
        return resolve(true)
      }
      if (error && error.code === "ENOTFOUND") {
        return resolve(false)
      }
      return reject(error)
    })
  })
}

const testCacheURL = (url) => {
  if (url) {
    const urlObject = new URL(url)
    return portIsUsed(urlObject.port, urlObject.origin)
  }
  return Promise.resolve(false)
}

const compileServerURLGetMemoized = ({ root }) => {
  return readCache().then(({ compileServer, ...rest }) => {
    return testCacheURL(compileServer ? compileServer.url : null).then((valid) => {
      if (valid) {
        return compileServer.url
      }

      return openCompileServer({
        rootLocation: root,
        url: "http://127.0.0.1:0", // avoid https for now because certificates are self signed
      }).then((compileServer) => {
        writeCache({
          ...rest,
          compileServer: {
            url: compileServer.url.toString(),
          },
        })

        return compileServer.url
      })
    })
  })
}

const runServerURLGetMemoized = ({ compileURL, url }) => {
  return readCache().then(({ runServer, ...rest }) => {
    return testCacheURL(runServer ? runServer.url : null).then((valid) => {
      if (valid) {
        return runServer.url
      }

      return openServer({ url }).then((runServer) => {
        const loaderSrc = `${compileURL}node_modules/@dmail/module-loader/src/browser/index.js`

        runServer.addRequestHandler((request) => {
          const fileRelativeToRoot = request.url.pathname.slice(1)
          const pageBody = `<!doctype html>

					<head>
						<title>Run ${fileRelativeToRoot}</title>
						<meta charset="utf-8" />
						<script src="${loaderSrc}"></script>
						<script type="text/javascript">
							window.System = window.createBrowserLoader.createBrowserLoader()
							window.System.import("${compileURL}compiled/${fileRelativeToRoot}")
						</script>
					</head>

					<body>
						<main></main>
					</body>

					</html>`

          return {
            status: 200,
            headers: {
              "content-type": "text/html",
              "content-length": Buffer.byteLength(pageBody),
              "cache-control": "no-store",
            },
            body: pageBody,
          }
        })

        writeCache({
          ...rest,
          runServer: {
            compileURL: compileURL.toString(),
            url: runServer.url.toString(),
          },
        })

        return runServer.url
      })
    })
  })
}

export const open = ({ root, url }) => {
  return compileServerURLGetMemoized({
    root,
    url: "http://127.0.0.1:0", // avoid https
  }).then((compileServerURL) => {
    return runServerURLGetMemoized({
      compileURL: compileServerURL,
      url,
    }).then((runServerURL) => {
      return {
        compileServerURL,
        runServerURL,
      }
    })
  })
}
