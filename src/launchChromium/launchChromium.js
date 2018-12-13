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
import { createPromiseAndHooks } from "../promiseHelper.js"

// https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md

export const launchChromium = async ({
  cancellationToken = createCancellationToken(),
  localRoot,
  remoteRoot,
  compileInto,

  protocol = "http",
  ip = "127.0.0.1",
  port = 0,
  openIndexRequestHandler = serverIndexOpen,
  headless = true,
  mirrorConsole = false,
}) => {
  if (openIndexRequestHandler === openIndexRequestInterception && headless === false) {
    throw new Error(`openIndexRequestInterception work only in headless mode`)
  }

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
    stop: (browser) => browser.close(),
  })

  const pageTracker = createPageTracker(browser)

  const disconnected = createPromiseAndHooks()
  // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-disconnected
  browser.on("disconnected", disconnected.resolve)

  const errored = createPromiseAndHooks()

  const closed = createPromiseAndHooks()
  // yeah closed and disconnected are the same.. is this a problem ?
  browser.on("disconnected", closed.resolve)

  const close = async (reason) => {
    await pageTracker.close(reason)
    return browser.close()
  }

  browser.on("targetcreated", (page) => {
    // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-error
    page.on("error", errored.resolve)
    // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-pageerror
    page.on("pageerror", errored.resolve)

    if (mirrorConsole) {
      page.on("console", (message) => {
        // there is also message._args
        // which is an array of JSHandle{ _context, _client _remoteObject }
        console[message._type](message._text)
      })
    }
  })

  const fileToExecuted = async (file, options) => {
    const compileMap = JSON.parse(await readFile(getCompileMapLocalURL({ localRoot, compileInto })))

    // todo: promise.all on page and html
    const page = await browser.newPage()
    const html = await createHTMLForBrowser({
      scriptRemoteList: [{ url: getBrowserPlatformRemoteURL({ remoteRoot, compileInto }) }],
      scriptInlineList: [
        {
          source: createBrowserPlatformSource({
            remoteRoot,
            compileInto,
            compileMap,
          }),
        },
      ],
    })

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

const createPageTracker = (browser) => {
  const pages = []

  browser.on("targetcreated", (page) => {
    pages.push(page)
  })

  const close = () => {
    // in case of bug do not forget https://github.com/GoogleChrome/puppeteer/issues/2269
    return Promise.all(pages.map((page) => page.close()))
  }

  return { close }
}

const openIndexRequestInterception = async ({
  cancellationToken,
  protocol,
  ip,
  port,
  page,
  body,
}) => {
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
