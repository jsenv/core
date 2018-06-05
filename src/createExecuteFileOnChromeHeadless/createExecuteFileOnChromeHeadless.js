import { createSignal } from "@dmail/signal"
import puppeteer from "puppeteer"
import { startServer } from "../startServer/startServer.js"
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

export const startIndexRequestServer = ({ indexBody }) => {
  return startServer().then((server) => {
    server.addRequestHandler((request, response) => {
      response.writeHead(200, {
        "content-type": "text/html",
        "content-length": Buffer.byteLength(indexBody),
        "cache-control": "no-store",
      })
      response.end(indexBody)
    })
    return { url: String(server.url), close: server.close }
  })
}

export const startIndexRequestInterception = ({ page, indexBody }) => {
  const fakeURL = "https://fake.com"

  return page
    .setRequestInterception(true)
    .then(() => {
      page.on("request", (interceptedRequest) => {
        if (interceptedRequest.url().startsWith(fakeURL)) {
          interceptedRequest.respond({
            status: 200,
            contentType: "text/html",
            headers: {
              "content-type": "text/html",
              "content-length": Buffer.byteLength(indexBody),
              "cache-control": "no-store",
            },
            body: indexBody,
          })
          return
        }
      })
    })
    .then(() => {
      return {
        url: fakeURL,
        close: () => page.setRequestInterception(false),
      }
    })
}

export const createExecuteFileOnChromeHeadless = ({
  serverURL,
  startIndexRequestHandler = startIndexRequestServer,
  autoClose = false,
}) => {
  if (startIndexRequestHandler === startIndexRequestInterception) {
    throw new Error(
      `startIndexRequestInterception does not work, request made to other domain remains pending`,
    )
  }

  const execute = (file) => {
    const ended = createSignal()
    const crashed = createSignal()
    const entry = String(new URL(file, serverURL))

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

    const createPageUnexpectedBranch = (page) => {
      return new Promise((resolve, reject) => {
        // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-error
        page.on("error", reject)
        // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-pageerror
        page.on("pageerror", reject)
      })
    }

    const createPageExpectedBranch = (page) => {
      const shouldCloseIndexRequestHandler = autoClose

      // page.on("console", (message) => {
      // 	console.log("message", message)
      // 	// message.args()
      // 	// message.text()
      // })

      return startIndexRequestHandler({
        page,
        indexBody: createIndexHTML({
          loaderSrc: `${serverURL}node_modules/@dmail/module-loader/src/browser/index.js`,
        }),
      }).then((indexRequestHandler) => {
        return page
          .goto(indexRequestHandler.url)
          .then(() => {
            return page.evaluate((entry) => {
              return window.System.import(entry)
            }, entry)
          })
          .then(
            (value) => {
              if (shouldCloseIndexRequestHandler) {
                indexRequestHandler.close()
              }
              return value
            },
            (reason) => {
              if (shouldCloseIndexRequestHandler) {
                indexRequestHandler.close()
              }
              return Promise.reject(reason)
            },
          )
      })
    }

    const executeInPage = (page) => {
      const shouldClosePage = autoClose

      return Promise.race([createPageUnexpectedBranch(page), createPageExpectedBranch(page)]).then(
        (value) => {
          if (shouldClosePage) {
            page.close()
          }
          return value
        },
        (reason) => {
          if (shouldClosePage) {
            page.close()
          }
          return Promise.reject(reason)
        },
      )
    }

    const shouldCloseBrowser = autoClose
    startBrowser()
      .then((browser) =>
        browser
          .newPage()
          .then(executeInPage)
          .then(
            (value) => {
              if (shouldCloseBrowser) {
                browser.close()
              }
              return value
            },
            (reason) => {
              if (shouldCloseBrowser) {
                browser.close()
              }
              return Promise.reject(reason)
            },
          ),
      )
      .then(ended.emit, crashed.emit)

    return { ended, crashed }
  }

  return { execute }
}
