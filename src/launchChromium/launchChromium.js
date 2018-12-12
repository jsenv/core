import { URL } from "url"
import puppeteer from "puppeteer"
import { createCancellationToken, createOperation } from "@dmail/cancellation"
import { createHTMLForBrowser } from "../createHTMLForBrowser.js"
import { open as serverIndexOpen } from "../server-index/serverIndex.js"
import { originAsString } from "../server/index.js"
import { createBrowserPlatformSource } from "../createBrowserSource.js"
import {
  getBrowserPlatformRemoteURL,
  getCompileMapLocalURL,
} from "../compileBrowserPlatform/index.js"
import { eventRace, registerEvent, registerThen, registerCatch } from "../eventHelper.js"
import { readFile } from "../fileHelper.js"

export const launchChromium = async ({
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

  // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md
  // mais c'est seulement une fois le browser opened, que je peux ecouter les erreurs etc
  // et une fois la page opened aussi que je peux enrichir encore plus le truc
  // nodejs ne fonctionne pas exactement pareil, ca serais bien de trouver une interface commune
  //

  const openBrowser = async () => {
    return createOperation({
      cancellationToken,
      start: () =>
        puppeteer.launch({
          headless,
          ignoreHTTPSErrors: true, // because we use a self signed certificate
          // handleSIGINT: true,
          // handleSIGTERM: true,
          // handleSIGHUP: true,
          // because the 3 above are true by default pupeeter will auto close browser
          // so we apparently don't have to use listenNodeBeforeExit in order to close browser
          // as we do for server
        }),
      stop: (browser) => {
        log(`closing chromium`)
        return browser.close()
      },
    })
  }

  const openPage = async (browser) => {
    return createOperation({
      cancellationToken,
      start: () => browser.newPage(),
      stop: () => {
        // commented until https://github.com/GoogleChrome/puppeteer/issues/2269
        // return page.close()
      },
    })
  }

  const browser = await openBrowser()
  const page = await openPage(browser)

  const fileToExecuted = async (file, options) => {
    const compileMap = JSON.parse(await readFile(getCompileMapLocalURL({ localRoot, compileInto })))
    const html = await createHTMLForBrowser({
      scriptRemoteList: [{ url: getBrowserPlatformRemoteURL({ remoteRoot, compileInto }) }],
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
    })

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
          (file, options) => window.__platform__.executeFile(file, options),
          file,
          options,
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

  return { fileToExecuted }
}

const openIndexRequestInterception = async ({
  cancellationToken,
  protocol,
  ip,
  port,
  page,
  body,
}) => {
  cancellationToken.throwIfRequested()

  const origin = originAsString({ protocol, ip, port })

  const interceptionOperation = createOperation({
    cancellationToken,
    start: () => page.setRequestInterception(true),
    stop: () => page.setRequestInterception(false),
  })
  await interceptionOperation

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
