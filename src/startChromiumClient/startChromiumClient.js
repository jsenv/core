import puppeteer from "puppeteer"
import { startServer } from "../startServer/startServer.js"

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

export const startChromiumClient = ({
  server,
  startIndexRequestHandler = startIndexRequestServer,
  headless = true,
}) => {
  if (startIndexRequestHandler === startIndexRequestInterception) {
    throw new Error(
      `startIndexRequestInterception does not work, request made to other domain remains pending`,
    )
  }

  // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md
  return puppeteer
    .launch({
      headless,
      ignoreHTTPSErrors: true, // because we use a self signed certificate
      // handleSIGINT: true,
      // handleSIGTERM: true,
      // handleSIGHUP: true,
      // because the 3 above are true by default pupeeter will auto close browser
      // so we apparently don't have to use listenNodeBeforeExit in order to close browser
      // as we do for server
    })
    .then((browser) => {
      const execute = ({ file, autoClean = false }) => {
        return browser.newPage().then((page) => {
          const shouldClosePage = autoClean

          const createPageUnexpectedBranch = (page) => {
            return new Promise((resolve, reject) => {
              // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-error
              page.on("error", reject)
              // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-pageerror
              page.on("pageerror", reject)
            })
          }

          const createPageExpectedBranch = (page) => {
            const shouldCloseIndexRequestHandler = autoClean

            page.on("console", (message) => {
              // there is also message._args
              // which is an array of JSHandle{ _context, _client _remoteObject }
              console[message._type](message._text)
            })

            return startIndexRequestHandler({
              page,
              indexBody: createIndexHTML({
                loaderSrc: `${server.url}node_modules/@dmail/module-loader/src/browser/index.js`,
              }),
            }).then((indexRequestHandler) => {
              return page
                .goto(indexRequestHandler.url)
                .then(() => {
                  return page.evaluate((file) => {
                    return window.System.import(file)
                  }, file)
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

          return Promise.race([
            createPageUnexpectedBranch(page),
            createPageExpectedBranch(page),
          ]).then(
            (value) => {
              if (shouldClosePage) {
                // page.close() // commented until https://github.com/GoogleChrome/puppeteer/issues/2269
              }
              return value
            },
            (reason) => {
              if (shouldClosePage) {
                // page.close() // commented until https://github.com/GoogleChrome/puppeteer/issues/2269
              }
              return Promise.reject(reason)
            },
          )
        })
      }

      const close = () => {
        browser.close()
      }

      return { execute, close }
    })
}
