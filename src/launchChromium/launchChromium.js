import { URL } from "url"
import puppeteer from "puppeteer"
import { createCancellationToken, createOperation } from "@dmail/cancellation"
import { createHTMLForBrowser } from "../createHTMLForBrowser.js"
import { open as serverIndexOpen } from "../server-index/serverIndex.js"
import { originAsString } from "../server/index.js"
import {
  getBrowserPlatformRemoteURL,
  getCompileMapLocalURL,
} from "../compileBrowserPlatform/index.js"
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
  const browser = await createOperation({
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

  const page = await createOperation({
    cancellationToken,
    start: () => browser.newPage(),
    stop: () => {
      // commented until https://github.com/GoogleChrome/puppeteer/issues/2269
      // I think we may uncomment it if we are sure
      // every page.close is awaited before
      // calling browser.close()
      // which cancelllationToken should do by default
      // return page.close()
    },
  })

  const disconnected = new Promise((resolve) => {
    // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-disconnected
    browser.on("disconnected", resolve)
  })

  const errored = new Promise((resolve) => {
    // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-error
    page.on("error", resolve)
    // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-pageerror
    page.on("pageerror", resolve)
  })

  const closed = new Promise((resolve) => {
    // yeah closed and disconnected are the same.. is this a problem ?
    browser.on("disconnected", resolve)
  })

  const close = () => browser.close()

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

  return { disconnected, errored, closed, close, fileToExecuted }
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
