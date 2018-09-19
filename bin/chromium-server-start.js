#!/usr/bin/env node

import { openServer } from "../src/openServer/openServer.js"
import { createHTMLForBrowser } from "../src/createHTMLForBrowser.js"

const getFromArguments = (name) => {
  const foundRawArg = process.argv.find((arg) => {
    return arg.startsWith(`--${name}=`)
  })
  if (!foundRawArg) {
    return
  }
  return foundRawArg.slice(`--${name}=`.length)
}

const compileURL = getFromArguments("compile-url") || "http://127.0.0.1:3001/compiled"
const port = Number(getFromArguments("port") || "3000")

const getClientScript = ({ compileURL, url }) => {
  const fileRelativeToRoot = url.pathname.slice(1)

  return `window.System.import("${compileURL}/${fileRelativeToRoot}")
if("__test__" in window) {
	window.__test__()
}`
}

openServer({ url: `http://127.0.0.1:${port}` }).then((runServer) => {
  runServer.addRequestHandler((request) => {
    return createHTMLForBrowser({
      script: getClientScript({ compileURL, url: request.url }),
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

  console.log(`chromium server listening at ${runServer.url}`)
})
