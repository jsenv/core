import { createSignal } from "@dmail/signal"
import puppeteer from "puppeteer"
import { startServer } from "../startServer/startServer.js"
// import { uneval } from "@dmail/uneval"
import { URL } from "url"

const createIndexHTML = ({ loaderSrc }) => `<!doctype html>

<head>
	<title>Skeleton for chrome headless</title>
	<meta charset="utf-8" />
	<script src="${loaderSrc}"></script>
	<script type="text/javascript">
		window.System = window.createBrowserLoader.createBrowserLoader()
	</script>
</head>

<body>
	<main></main>
</body>

</html>`

// we could also do this
// https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#pagesetrequestinterceptionvalue
// instead of starting a server

export const createExecuteFileOnChromeHeadless = ({ serverURL }) => {
  const execute = (file) => {
    const ended = createSignal()
    const crashed = createSignal()

    const startBrowser = () => {
      // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md
      return puppeteer.launch({
        headless: false,
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
      const indexBody = createIndexHTML({
        loaderSrc: `${serverURL}node_modules/@dmail/module-loader/src/browser/index.js`,
      })

      server.addRequestHandler((request, response) => {
        response.writeHead(200, {
          "content-type": "text/html",
          "content-length": Buffer.byteLength(indexBody),
          "cache-control": "no-store",
        })
        response.end(indexBody)
      })

      return browser
        .newPage()
        .then((page) => {
          return new Promise((resolve, reject) => {
            // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-error
            page.on("error", reject)
            // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-pageerror
            page.on("pageerror", reject)
            page.on("console", (message) => {
              console.log("message", message)
              // message.args()
              // message.text()
            })

            const url = String(server.url)
            resolve(
              page.goto(url).then(() => {
                const entry = String(new URL(file, serverURL))
                return page.evaluate((entry) => {
                  return window.System.import(entry)
                }, entry)
              }),
            )
          })
        })
        .then(
          (value) => {
            // browser.close()
            server.close()
            ended.emit(value)
          },
          (reason) => {
            // browser.close()
            server.close()
            crashed.emit(reason)
          },
        )
    }, crashed.emit)

    return { ended, crashed }
  }

  return { execute }
}
