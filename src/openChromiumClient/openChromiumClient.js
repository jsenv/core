import puppeteer from "puppeteer"
import { createBrowserIndexHTML } from "../createBrowserIndexHTML.js"
import { openIndexServer } from "../openIndexServer/openIndexServer.js"
import { getRemoteLocation } from "../getRemoteLocation.js"
import { getBrowserSetupAndTeardowm } from "../getClientSetupAndTeardown.js"
import { createSignal } from "@dmail/signal"

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
  mirrorConsole = false,
  runFile = ({ page, file, setup, teardown }) => {
    return page.evaluate(
      (file, setupSource, teardownSource) => {
        eval(setupSource)(file)
        return window.System.import(file).then(eval(teardownSource))
      },
      file,
      `(${setup.toString()})`,
      `(${teardown.toString()})`,
    )
  },
}) => {
  if (openIndexRequestHandler === openIndexRequestInterception && headless === false) {
    throw new Error(`openIndexRequestInterception work only in headless mode`)
  }

  const openBrowser = () => {
    return puppeteer.launch({
      headless,
      ignoreHTTPSErrors: true, // because we use a self signed certificate
      // handleSIGINT: true,
      // handleSIGTERM: true,
      // handleSIGHUP: true,
      // because the 3 above are true by default pupeeter will auto close browser
      // so we apparently don't have to use listenNodeBeforeExit in order to close browser
      // as we do for server
    })
  }

  // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md
  const execute = ({
    file,
    autoClose = false,
    // autoCloseOnError is different than autoClose because you often want to keep browser opened to debug error
    autoCloseOnError = false,
    collectCoverage = false,
    executeTest = false,
  }) => {
    const closed = createSignal()

    const close = () => {
      closed.emit()
    }

    const promise = openBrowser()
      .then((browser) => {
        closed.listen(() => {
          browser.close()
        })

        return browser.newPage().then((page) => {
          closed.listen(() => {
            // page.close() // commented until https://github.com/GoogleChrome/puppeteer/issues/2269
          })

          const createPageUnexpectedBranch = (page) => {
            return new Promise((resolve, reject) => {
              // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-error
              page.on("error", reject)
              // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-pageerror
              page.on("pageerror", reject)
            })
          }

          const createPageExpectedBranch = (page) => {
            if (mirrorConsole) {
              page.on("console", (message) => {
                // there is also message._args
                // which is an array of JSHandle{ _context, _client _remoteObject }
                console[message._type](message._text)
              })
            }

            return openIndexRequestHandler({
              page,
              body: createBrowserIndexHTML({
                loaderSrc: `${server.url}node_modules/@dmail/module-loader/src/browser/index.js`,
              }),
            }).then((indexRequestHandler) => {
              closed.listen(() => {
                indexRequestHandler.close()
              })

              const remoteFile = getRemoteLocation({
                server,
                file,
              })

              return page.goto(indexRequestHandler.url).then(() =>
                runFile({
                  page,
                  file: remoteFile,
                  ...getBrowserSetupAndTeardowm({ collectCoverage, executeTest }),
                }),
              )
            })
          }

          return Promise.race([createPageUnexpectedBranch(page), createPageExpectedBranch(page)])
        })
      })
      .then(
        (value) => {
          if (autoClose) {
            close()
          }
          return value
        },
        (reason) => {
          if (autoCloseOnError) {
            close()
          }
          return Promise.reject(reason)
        },
      )

    return Promise.resolve({
      promise,
      close,
    })
  }

  return Promise.resolve({ execute })
}
