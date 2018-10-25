import { createHTMLForBrowser } from "../createHTMLForBrowser.js"
import { open as serverIndexOpen } from "../server-index/serverIndex.js"
import { URL } from "url"
import { originAsString } from "../server/index.js"
import { createBrowserPlatformSource } from "../createBrowserSource.js"
import {
  getBrowserSystemRemoteURL,
  getBrowserPlatformRemoteURL,
} from "../compilePlatformAndSystem.js"
import { createCancellable } from "../cancellable/index.js"

const openIndexRequestInterception = ({ protocol, ip, port, page, body }) => {
  const origin = originAsString({ protocol, ip, port })

  const cancellable = createCancellable()

  return cancellable.wrap(
    page
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
        cancellable.addCancellingTask(() => page.setRequestInterception(false))

        return {
          origin,
        }
      }),
  )
}

export const createExecuteOnChromium = ({
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
    const cancellable = createCancellable()

    // this module must not force dev-server to have pupeteer dependency
    // this module must become external
    const puppeteer = {}

    return cancellable.map(
      puppeteer
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
          cancellable.addCancellingTask(() => browser.close())
          return browser
        }),
    )
  }

  const openPage = (browser) => {
    const cancellable = createCancellable()

    return cancellable.map(
      browser.newPage().then((page) => {
        cancellable.addCancellingTask(() => {
          // page.close() // commented until https://github.com/GoogleChrome/puppeteer/issues/2269
        })
        return page
      }),
    )
  }

  // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md
  const execute = ({ file, instrument = false, setup = () => {}, teardown = () => {} }) => {
    const cancellable = createCancellable()

    return cancellable.map(
      openBrowser().then((browser) => {
        return cancellable.map(openPage(browser)).then((page) => {
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
              return cancellable
                .map(
                  openIndexRequestHandler({
                    protocol,
                    ip,
                    port,
                    page,
                    body: html,
                  }),
                )
                .then((indexRequestHandler) => {
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
      }),
    )
  }

  return { execute }
}
