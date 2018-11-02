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
import { eventRace, registerEvent, registerThen, registerCatch } from "../eventHelper.js"

// this module must not force dev-server to have pupeteer dependency
// this module must become external
const puppeteer = {}

const openIndexRequestInterception = async ({ cancellation, protocol, ip, port, page, body }) => {
  await cancellation.toPromise()

  const origin = originAsString({ protocol, ip, port })

  const setPromise = page.setRequestInterception(true)
  cancellation.register(() => setPromise.then(() => page.setRequestInterception(false)))

  await setPromise

  page.on("request", (interceptedRequest) => {
    const url = new URL(interceptedRequest.url())

    if (url.origin !== origin) return

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
  })

  return {
    origin,
  }
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

  const openBrowser = async () => {
    await cancellation.toPromise()

    const browserPromise = puppeteer.launch({
      headless,
      ignoreHTTPSErrors: true, // because we use a self signed certificate
      // handleSIGINT: true,
      // handleSIGTERM: true,
      // handleSIGHUP: true,
      // because the 3 above are true by default pupeeter will auto close browser
      // so we apparently don't have to use listenNodeBeforeExit in order to close browser
      // as we do for server
    })
    cancellation.register(browserPromise.then((browser) => browser.close()))

    return browserPromise
  }

  const openPage = async (browser) => {
    await cancellation.toPromise()

    const pagePromise = browser.newPage()
    cancellation.register(() => {
      // page.close() // commented until https://github.com/GoogleChrome/puppeteer/issues/2269
    })
    return pagePromise
  }

  // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md
  const execute = async ({
    cancellation = cancellationNone,
    file,
    instrument = false,
    setup = () => {},
    teardown = () => {},
  }) => {
    const browser = await openBrowser()
    const [page, html] = await Promise.all([
      openPage(browser),
      createHTMLForBrowser({
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
      }),
    ])

    if (mirrorConsole) {
      page.on("console", (message) => {
        // there is also message._args
        // which is an array of JSHandle{ _context, _client _remoteObject }
        console[message._type](message._text)
      })
    }

    return new Promise((resolve, reject) => {
      const execute = async () => {
        const { origin } = await openIndexRequestHandler({
          cancellation,
          protocol,
          ip,
          port,
          page,
          body: html,
        })
        await page.goto(origin)
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
      }
      const executePromise = execute()

      // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-error
      const crashRegister = (callback) => registerEvent(page, "error", callback)
      // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-pageerror
      const errorRegister = (callback) => registerEvent(page, "pageerror", callback)
      const successRegister = (callback) => registerThen(executePromise, callback)
      const failureRegister = (callback) => registerCatch(executePromise, callback)

      eventRace({
        crash: {
          register: crashRegister,
          callback: reject,
        },
        error: {
          register: errorRegister,
          callback: reject,
        },
        success: {
          register: successRegister,
          callback: resolve,
        },
        failure: {
          register: failureRegister,
          callback: reject,
        },
      })
    })
  }

  return execute
}
