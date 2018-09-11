#!/usr/bin/env node

import { openCompileServer } from "../src/openCompileServer/openCompileServer.js"
import { openServer } from "../src/openServer/openServer.js"

const openRunServer = ({ compileServerURL, compileURL, url }) => {
  return openServer({ url }).then((runServer) => {
    const loaderSrc = `${compileServerURL}node_modules/@dmail/module-loader/src/browser/index.js`

    runServer.addRequestHandler((request) => {
      const fileRelativeToRoot = request.url.pathname.slice(1)
      const pageBody = `<!doctype html>

			<head>
				<title>Run ${fileRelativeToRoot}</title>
				<meta charset="utf-8" />
			</head>

			<body>
				<main></main>
				<script src="${loaderSrc}"></script>
				<script type="text/javascript">
					window.System = window.createBrowserLoader.createBrowserLoader()
					window.System.import("${compileURL}${fileRelativeToRoot}")
				</script>
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

    return runServer.url
  })
}

export const open = ({ root, url, compiledFolder }) => {
  return openCompileServer({
    rootLocation: root,
    compiledFolderRelativeLocation: compiledFolder,
    url: "http://127.0.0.1:3001", // avoid https for now because certificates are self signed
  }).then((compileServer) => {
    return openRunServer({
      compileServerURL: compileServer.url,
      url,
    }).then((runServerURL) => {
      return {
        compileServerURL: compileServer.url,
        runServerURL,
      }
    })
  })
}
