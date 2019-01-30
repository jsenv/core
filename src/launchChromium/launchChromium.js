// https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md

import { URL } from "url"
import puppeteer from "puppeteer"
import { uneval } from "@dmail/uneval"
import { createCancellationToken, createStoppableOperation } from "@dmail/cancellation"
import { startIndexServer } from "../server-index/startIndexServer.js"
import { originAsString } from "../server/index.js"
import { createPromiseAndHooks } from "../promiseHelper.js"
import { getBrowserPlatformRemoteURL } from "../platform/browser/remoteURL.js"
import { regexpEscape } from "../stringHelper.js"

export const launchChromium = async ({
  cancellationToken = createCancellationToken(),
  localRoot,
  remoteRoot,
  compileInto,
  mirrorConsole,
  // capture console to be implemented
  // captureConsole,

  protocol = "http",
  ip = "127.0.0.1",
  port = 0,
  startIndexRequestHandler = startIndexServer,
  headless = true,
  generateHTML = ({ remoteRoot, compileInto, browserPlatformRemoteURL }) => {
    return `<!doctype html>

<head>
  <title>Untitled</title>
  <meta charset="utf-8" />
</head>

<body>
  <main></main>
  <script src="${browserPlatformRemoteURL}"></script>
  <script type="text/javascript">
    window.__platform__ = window.__platform__.platform
    window.__platform__.setup({
      "remoteRoot": ${uneval(remoteRoot)},
      "compileInto": ${uneval(compileInto)}
    })
  </script>
</body>

</html>`
  },
}) => {
  if (startIndexRequestHandler === startIndexRequestInterception && headless === false) {
    throw new Error(`startIndexRequestInterception work only in headless mode`)
  }

  const options = {
    headless,
    // because we use a self signed certificate
    ignoreHTTPSErrors: true,
    // handleSIGINT: true,
    // handleSIGTERM: true,
    // handleSIGHUP: true,
    // because the 3 above are true by default pupeeter will auto close browser
    // so we apparently don't have to use listenNodeBeforeExit in order to close browser
    // as we do for server
  }

  const browser = await createStoppableOperation({
    cancellationToken,
    start: () => puppeteer.launch(options),
    stop: (browser) => browser.close(),
  })

  const targetTracker = createTargetTracker(browser)

  const disconnected = createPromiseAndHooks()
  // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-disconnected
  browser.on("disconnected", disconnected.resolve)

  let stopIndexServer = () => {}
  const stop = async (reason) => {
    await Promise.all([targetTracker.stop(reason), stopIndexServer(reason)])
    await browser.close()
  }

  const chromeErrorToLocalError = (error) => {
    // does not truly work
    // error stack should be remapped either client side or here
    // error is correctly remapped inside chrome devtools
    // but the error we receive here is not remapped
    // client side would be better but here could be enough
    const remoteRootRegexp = new RegExp(regexpEscape(remoteRoot), "g")
    error.stack = error.stack.replace(remoteRootRegexp, localRoot)
    error.message = error.message.replace(remoteRootRegexp, localRoot)
    return error
  }

  const errored = new Promise((resolve) => {
    const emitError = (error) => {
      resolve(chromeErrorToLocalError(error))
    }

    const trackPage = (browser) => {
      browser.on("targetcreated", async (target) => {
        if (target.type === "browser") {
          const childBrowser = target.browser()
          trackPage(childBrowser)
        }

        // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#class-target
        if (target.type === "page") {
          const page = await target.page()
          // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-error
          page.on("error", emitError)
          // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-pageerror
          page.on("pageerror", emitError)

          if (mirrorConsole) {
            page.on("console", (message) => {
              // there is also message._args
              // which is an array of JSHandle{ _context, _client _remoteObject }
              console[message._type](message._text)
            })
          }
        }
      })
    }
    trackPage(browser)
  })

  const fileToExecuted = async (file, options) => {
    const [page, html] = await Promise.all([
      browser.newPage(),
      generateHTML({
        remoteRoot,
        compileInto,
        browserPlatformRemoteURL: getBrowserPlatformRemoteURL({ remoteRoot, compileInto }),
      }),
    ])

    const { origin: indexOrigin, stop: indexStop } = await startIndexRequestHandler({
      cancellationToken,
      protocol,
      ip,
      port,
      page,
      body: html,
    })
    stopIndexServer = indexStop

    await page.goto(indexOrigin)
    try {
      return await page.evaluate(
        (file, options) => window.__platform__.importFile(file, options),
        file,
        options,
      )
    } catch (e) {
      throw chromeErrorToLocalError(e)
    }
  }

  return { options, disconnected, errored, stop, fileToExecuted }
}

const createTargetTracker = (browser) => {
  let stopCallbackArray = []

  // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#class-target
  browser.on("targetcreated", (target) => {
    if (target.type === "browser") {
      const childBrowser = target.browser()
      const childTargetTracker = createTargetTracker(childBrowser)
      stopCallbackArray = [...stopCallbackArray, (reason) => childTargetTracker.stop(reason)]
    }
    if (target.type === "page" || target.type === "background_page") {
      // in case of bug do not forget https://github.com/GoogleChrome/puppeteer/issues/2269
      stopCallbackArray = [
        ...stopCallbackArray,
        async () => {
          const page = await target.page()
          return page.close()
        },
      ]
      return
    }
  })

  const stop = async (reason) => {
    const callbacks = stopCallbackArray.slice()
    stopCallbackArray.length = 0
    await Promise.all(callbacks.map((callback) => callback(reason)))
  }

  return { stop }
}

const startIndexRequestInterception = async ({
  cancellationToken,
  protocol,
  ip,
  port,
  page,
  body,
}) => {
  const origin = originAsString({ protocol, ip, port })

  const interceptionOperation = createStoppableOperation({
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

  const stop = interceptionOperation.stop

  return {
    origin,
    stop,
  }
}
