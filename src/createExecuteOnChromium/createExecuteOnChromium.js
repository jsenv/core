import { createHTMLForBrowser } from "../createHTMLForBrowser.js"
import { open as serverIndexOpen } from "../server-index/serverIndex.js"
import { URL } from "url"
import { originAsString } from "../server/index.js"
import { createBrowserPlatformSource } from "../createBrowserSource.js"
import {
  getBrowserSystemRemoteURL,
  getBrowserPlatformRemoteURL,
} from "../compilePlatformAndSystem.js"
import { cancellationNone } from "../cancel/index.js"

// this module must not force dev-server to have pupeteer dependency
// this module must become external
const puppeteer = {}

const openIndexRequestInterception = ({ cancellation, protocol, ip, port, page, body }) => {
  const origin = originAsString({ protocol, ip, port })

  return cancellation.wrap((register) => {
    page.setRequestInterception(true).then(() => {
      register(() => page.setRequestInterception(false))

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

      return {
        origin,
      }
    })
  })
}

export const createExecuteOnChromium = ({
  cancellation = cancellationNone,
  remoteRoot,
  compileInto,
  groupMap,
  hotreload = false,
  hotreloadSSERoot,

  protocol = "https",
  ip = "127.0.0.1",
  port = 0,
  openIndexRequestHandler = serverIndexOpen,
  headless = true,
  mirrorConsole = false,
}) => {
  if (openIndexRequestHandler === openIndexRequestInterception && headless === false) {
    throw new Error(`openIndexRequestInterception work only in headless mode`)
  }

  const openBrowser = () => {
    return cancellation.wrap((register) => {
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
          register(() => browser.close())
          return browser
        })
    })
  }

  const openPage = (browser) => {
    return cancellation.wrap((register) => {
      browser.newPage().then((page) => {
        register(() => {
          // page.close() // commented until https://github.com/GoogleChrome/puppeteer/issues/2269
        })
        return page
      })
    })
  }

  // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md
  const execute = ({
    cancellation = cancellationNone,
    file,
    instrument = false,
    setup = () => {},
    teardown = () => {},
  }) => {
    return openBrowser().then((browser) => {
      return openPage(browser).then((page) => {
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
            scriptRemoteList: [
              { url: getBrowserSystemRemoteURL({ remoteRoot, compileInto }) },
              { url: getBrowserPlatformRemoteURL({ remoteRoot, compileInto }) },
            ],
            scriptInlineList: [
              {
                source: createBrowserPlatformSource({
                  remoteRoot,
                  compileInto,
                  groupMap,
                  hotreload,
                  hotreloadSSERoot,
                }),
              },
            ],
          }).then((html) => {
            return openIndexRequestHandler({
              cancellation,
              protocol,
              ip,
              port,
              page,
              body: html,
            }).then((indexRequestHandler) => {
              return page.goto(indexRequestHandler.origin).then(() => {
                return page.evaluate(
                  (file, instrument, setup, teardown) => {
                    return window.__platform__.executeFile({
                      file,
                      instrument,
                      setup,
                      teardown,
                    })
                  },
                  file,
                  instrument,
                  setup,
                  teardown,
                )
              })
            })
          })
        }

        return Promise.race([createPageUnexpectedBranch(page), createPageExpectedBranch(page)])
      })
    })
  }

  return execute
}
