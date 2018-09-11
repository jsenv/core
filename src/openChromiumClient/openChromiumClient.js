import puppeteer from "puppeteer"
import { createBrowserIndexHTML } from "../createBrowserIndexHTML.js"
import { openIndexServer } from "../openIndexServer/openIndexServer.js"
import { getRemoteLocation } from "../getRemoteLocation.js"

const openIndexRequestInterception = ({ page, body }) => {
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
              "content-length": Buffer.byteLength(body),
              "cache-control": "no-store",
            },
            body,
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

export const openChromiumClient = ({
  server,
  openIndexRequestHandler = openIndexServer,
  headless = true,
  runFile = ({ page, remoteRoot, file, instrument, transpile }) => {
    const remoteFile = getRemoteLocation({ remoteRoot, file, instrument, transpile })

    return page.evaluate(
      (remoteFile, instrument) => {
        if (instrument) {
          console.log("import with instrumentation")
          return window.System.import(remoteFile).then((value) => {
            return {
              coverage: window.__coverage__,
              value,
            }
          })
        }
        // we could also import the raw version if we want
        return window.System.import(remoteFile)
      },
      remoteFile,
      instrument,
    )
  },
}) => {
  if (openIndexRequestHandler === openIndexRequestInterception && headless === false) {
    throw new Error(`openIndexRequestInterception work only in headless mode`)
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
      const execute = ({ file, autoClean = false, instrument = false, transpile = true }) => {
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

            return openIndexRequestHandler({
              page,
              body: createBrowserIndexHTML({
                loaderSrc: `${server.url}node_modules/@dmail/module-loader/src/browser/index.js`,
              }),
            }).then((indexRequestHandler) => {
              return page
                .goto(indexRequestHandler.url)
                .then(() =>
                  runFile({
                    page,
                    remoteRoot: server.url.toString().slice(0, -1),
                    file,
                    instrument,
                    transpile,
                  }),
                )
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
