#!/usr/bin/env node

import { getFromProcessArguments } from "./getFromProcessArguments.js"
import { openCompileServer } from "../src/openCompileServer/openCompileServer.js"
import { openServer } from "../src/openServer/openServer.js"
import { createHTMLForBrowser } from "../src/createHTMLForBrowser.js"
import killPort from "kill-port"

const port = Number(getFromProcessArguments("port") || "3000")
const root = getFromProcessArguments("root") || process.cwd()

const getClientScript = ({ compileURL, url }) => {
  const fileRelativeToRoot = url.pathname.slice(1)

  return `window.System.import("${compileURL}/${fileRelativeToRoot}")`
}

const open = () => {
  openCompileServer({
    url: "http://127.0.0.1:0",
    rootLocation: root,
  }).then((server) => {
    openServer({ url: `http://127.0.0.1:${port}` }).then((runServer) => {
      runServer.addRequestHandler((request) => {
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

      console.log(`chromium server listening at ${runServer.url}`)
    })
  })
}

killPort(port).then(open)
