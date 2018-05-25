import { createSignal } from "@dmail/signal"
import puppeteer from "puppeteer"
import { startServer } from "../startServer/startServer.js"
import fs from "fs"
import { uneval } from "@dmail/uneval"

const indexTemplate = fs.readFileSync("./index.html")

export const createExecuteFileOnChromeHeadless = ({ serverURL }) => {
  const execute = (file) => {
    const ended = createSignal()
    const crashed = createSignal()

    const startBrowser = () => {
      // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md
      return puppeteer.launch({
        ignoreHTTPSErrors: true, // because we use a self signed certificate
        // handleSIGINT: true,
        // handleSIGTERM: true,
        // handleSIGHUP: true,
        // because the 3 above are true by default pupeeter will auto close browser
        // so we apparently don't have to use listenNodeBeforeExit in order to close browser
        // as we do for server
      })
    }

    Promise.all([startBrowser(), startServer()]).then(([browser, server]) => {
      const params = {
        loaderSrc: `${serverURL}/node_modules/@dmail/module-loader/src/browser/index.js`,
        entry: String(new URL(file, serverURL)),
      }

      const indexBody = indexTemplate.replace("window.__PARAMS__", uneval(params))

      server.addRequestHandler((request, response) => {
        response.writeHead(200, {
          "content-type": "text/html",
          "content-length": Buffer.byteLength(indexBody.length),
          "cache-control": "no-store",
        })
        response.end(indexBody)
      })

      return browser
        .newPage()
        .then((page) => page.goto(String(server.url)))
        .then(() => server.close().then(ended.emit))
    }, crashed.emit)

    return { ended, crashed }
  }

  return { execute }
}
