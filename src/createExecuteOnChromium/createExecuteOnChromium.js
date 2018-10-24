import { createHTMLForBrowser } from "../createHTMLForBrowser.js"
import { open as serverIndexOpen } from "../server-index/serverIndex.js"
import { createSignal } from "@dmail/signal"
import { URL } from "url"
import { originAsString } from "../server/index.js"

const openIndexRequestInterception = ({ protocol, ip, port, page, body }) => {
  const origin = originAsString({ protocol, ip, port })

  return page
    .setRequestInterception(true)
    .then(() => {
      page.on("request", (interceptedRequest) => {
        const url = new URL(interceptedRequest.url())

        if (url.origin === origin) {
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
        origin,
        close: () => page.setRequestInterception(false),
      }
    })
}

export const createExecuteOnChromium = ({
  remoteRoot,
  remoteCompileDestination,
  protocol = "https",
  ip = "127.0.0.1",
  port = 0,
  openIndexRequestHandler = serverIndexOpen,
  headless = true,
  mirrorConsole = false,
  runFile = ({ page, remoteRoot, remoteCompileDestination, file, setup, teardown, hotreload }) => {
    return page.evaluate(
      (remoteRoot, remoteCompileDestination, file, setupSource, teardownSource, hotreload) => {
        const remoteFile = `${remoteRoot}/${remoteCompileDestination}/${file}`

        return Promise.resolve().then(() => {
          if (hotreload) {
            const eventSource = new window.EventSource(remoteRoot, { withCredentials: true })
            eventSource.addEventListener("file-changed", (e) => {
              if (e.origin !== remoteRoot) {
                return
              }
              const fileChanged = e.data
              const changedFileLocation = `${remoteRoot}/${remoteCompileDestination}/${fileChanged}`
              if (window.System.get(changedFileLocation)) {
                console.log(fileChanged, "modified, reloading")
                window.location.reload()
              }
            })
          }

          const setup = eval(setupSource)
          const teardown = eval(teardownSource)

          return Promise.resolve()
            .then(setup)
            .then(() => window.System.import(remoteFile))
            .then(teardown)
        })
      },
      remoteRoot,
      remoteCompileDestination,
      file,
      `(${setup.toString()})`,
      `(${teardown.toString()})`,
      hotreload,
    )
  },
}) => {
  if (openIndexRequestHandler === openIndexRequestInterception && headless === false) {
    throw new Error(`openIndexRequestInterception work only in headless mode`)
  }

  const openBrowser = () => {
    // this module must not force dev-server to have pupeteer dependency
    // this module must become external
    const puppeteer = {}
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
    setup = () => {},
    teardown = () => {},
    hotreload = false,
    autoClose = false,
    // autoCloseOnError is different than autoClose because you often want to keep browser opened to debug error
    autoCloseOnError = false,
  }) => {
    const closed = createSignal({ smart: true })
    const close = closed.emit

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

            return createHTMLForBrowser({
              title: "Skeleton for Chromium",
            }).then((html) => {
              return openIndexRequestHandler({
                protocol,
                ip,
                port,
                page,
                body: html,
              }).then((indexRequestHandler) => {
                closed.listen(() => {
                  indexRequestHandler.close()
                })

                return page.goto(indexRequestHandler.origin).then(() =>
                  runFile({
                    page,
                    remoteRoot,
                    remoteCompileDestination,
                    file,
                    setup,
                    teardown,
                    hotreload,
                  }),
                )
              })
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

    promise.cancel = close
    return promise
  }

  return { execute }
}
