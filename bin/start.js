#!/usr/bin/env node

import { openCompileServer } from "../src/openCompileServer/openCompileServer.js"
import { openServer } from "../src/openServer/openServer.js"
import path from "path"

const getFromArguments = (name) => {
  const foundRawArg = process.argv.find((arg) => {
    return arg.startsWith(`--${name}=`)
  })
  if (!foundRawArg) {
    return
  }
  return foundRawArg.slice(`--${name}=`.length)
}

const projectRoot = path.resolve(__dirname, "../../")
const port = Number(getFromArguments("port") || "0")
const file = getFromArguments("file") || `${projectRoot}/index.js`
if (file.startsWith(projectRoot) === false) {
  throw new Error(
    `The file to execute must be inside the project folder: ${file} is not inside ${projectRoot}`,
  )
}
const fileRelativeToProjectRoot = file.slice(projectRoot.length + 1)

Promise.all([
  openCompileServer({
    rootLocation: projectRoot,
    url: "http://127.0.0.1:0", // avoid https for now because certificates are self signed
  }),
  openServer({
    url: `http://127.0.0.1:${port}`,
  }),
]).then(([compileServer, indexServer]) => {
  console.log("compile server listening at", compileServer.url.toString())
  console.log(`server for ${fileRelativeToProjectRoot} listening at ${indexServer.url}`)

  const loaderSrc = `${compileServer.url}node_modules/@dmail/module-loader/src/browser/index.js`
  const indexBody = `<!doctype html>

  <head>
    <title>Skeleton for chrome headless</title>
    <meta charset="utf-8" />
    <script src="${loaderSrc}"></script>
    <script type="text/javascript">
      window.System = window.createBrowserLoader.createBrowserLoader()
      window.System.import("${compileServer.url}compiled/${fileRelativeToProjectRoot}")
    </script>
  </head>

  <body>
    <main></main>
  </body>

  </html>`

  indexServer.addRequestHandler((request, response) => {
    response.writeHead(200, {
      "content-type": "text/html",
      "content-length": Buffer.byteLength(indexBody),
      "cache-control": "no-store",
    })
    response.end(indexBody)
  })
})
