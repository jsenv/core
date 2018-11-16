import { createHTMLForBrowser } from "../createHTMLForBrowser.js"
import { open as serverIndexOpen } from "../server-index/serverIndex.js"
import { URL } from "url"
import { originAsString } from "../server/index.js"
import { createBrowserPlatformSource } from "../createBrowserSource.js"
import {
  getBrowserSystemRemoteURL,
  getBrowserPlatformRemoteURL,
  getCompileMapLocalURL,
} from "../compilePlatformAndSystem.js"
import { createCancellationToken, cancellationTokenToPromise } from "../cancellation/index.js"
import { eventRace, registerEvent, registerThen, registerCatch } from "../eventHelper.js"
import puppeteer from "puppeteer"
import { readFile } from "../fileHelper.js"

const openIndexRequestInterception = async ({
  cancellationToken,
  protocol,
  ip,
  port,
  page,
  body,
}) => {
  await cancellationTokenToPromise(cancellationToken)

  const origin = originAsString({ protocol, ip, port })

  const setPromise = page.setRequestInterception(true)
  cancellationToken.register(() => setPromise.then(() => page.setRequestInterception(false)))

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
  cancellationToken = createCancellationToken(),
  localRoot,
  remoteRoot,
  compileInto,
  hotreload = false,
  hotreloadSSERoot,

  protocol = "http",
  ip = "127.0.0.1",
  port = 0,
  openIndexRequestHandler = serverIndexOpen,
  headless = true,
  mirrorConsole = false,
  verbose = true,
}) => {
  if (openIndexRequestHandler === openIndexRequestInterception && headless === false) {
    throw new Error(`openIndexRequestInterception work only in headless mode`)
  }

  const log = (...args) => {
    if (verbose) {
      console.log(...args)
    }
  }

  const openBrowser = async () => {
    await cancellationTokenToPromise(cancellationToken)

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
    cancellationToken.register(async (reason) => {
      const browser = await browserPromise
      await browser.close()
      log(`chromium closed because ${reason}`)
    })

    return browserPromise
  }

  const openPage = async (browser) => {
    await cancellationTokenToPromise(cancellationToken)

    const pagePromise = browser.newPage()
    cancellationToken.register(() => {
      // page.close() // commented until https://github.com/GoogleChrome/puppeteer/issues/2269
    })
    return pagePromise
  }

  // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md
  const execute = async ({
    cancellationToken = createCancellationToken(),
    file,
    instrument = false,
    setup = () => {},
    teardown = () => {},
  }) => {
    const browser = await openBrowser()
    const compileMap = JSON.parse(await readFile(getCompileMapLocalURL({ localRoot, compileInto })))
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
              compileMap,
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
          cancellationToken,
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
