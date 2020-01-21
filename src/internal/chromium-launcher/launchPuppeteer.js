/* eslint-disable import/max-dependencies */
// https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md

import { createCancellationToken, createStoppableOperation } from "@jsenv/cancellation"
import { interruptSignal, teardownSignal } from "@jsenv/node-signals"
import { require } from "internal/require.js"
import { fetchUrl } from "internal/fetchUrl.js"
import { validateResponseStatusIsOk } from "internal/validateResponseStatusIsOk.js"
import { trackRessources } from "./trackRessources.js"

const puppeteer = require("puppeteer")

export const launchPuppeteer = async ({
  cancellationToken = createCancellationToken(),
  headless = true,
  debug = false,
  debugPort = 9222,
  stopOnExit = true,
  stopOnSIGINT = true,
}) => {
  const options = {
    headless,
    ...(debug ? { devtools: true } : {}),
    // because we use a self signed certificate
    ignoreHTTPSErrors: true,
    args: [
      // https://github.com/GoogleChrome/puppeteer/issues/1834
      // https://github.com/GoogleChrome/puppeteer/blob/master/docs/troubleshooting.md#tips
      // "--disable-dev-shm-usage",
      `--remote-debugging-port=${debugPort}`,
    ],
  }

  const { registerCleanupCallback, cleanup } = trackRessources()

  const browserOperation = createStoppableOperation({
    cancellationToken,
    start: () =>
      puppeteer.launch({
        ...options,
        // let's handle them to close properly browser, remove listener
        // and so on, instead of relying on puppetter
        handleSIGINT: false,
        handleSIGTERM: false,
        handleSIGHUP: false,
      }),
    stop: async (browser, reason) => {
      await cleanup(reason)

      const disconnectedPromise = new Promise((resolve) => {
        const disconnectedCallback = () => {
          browser.removeListener("disconnected", disconnectedCallback)
          resolve()
        }
        browser.on("disconnected", disconnectedCallback)
      })
      await browser.close()
      await disconnectedPromise
    },
  })
  const { stop } = browserOperation

  if (stopOnExit) {
    const unregisterProcessTeadown = teardownSignal.addCallback((reason) => {
      stop(`process ${reason}`)
    })
    registerCleanupCallback(unregisterProcessTeadown)
  }
  if (stopOnSIGINT) {
    const unregisterProcessInterrupt = interruptSignal.addCallback(() => {
      stop("process sigint")
    })
    registerCleanupCallback(unregisterProcessInterrupt)
  }

  const browser = await browserOperation

  if (debug) {
    // https://github.com/puppeteer/puppeteer/blob/v2.0.0/docs/api.md#browserwsendpoint
    // https://chromedevtools.github.io/devtools-protocol/#how-do-i-access-the-browser-target
    const webSocketEndpoint = browser.wsEndpoint()
    const webSocketUrl = new URL(webSocketEndpoint)
    const browserEndpoint = `http://${webSocketUrl.host}/json/version`
    const browserResponse = await fetchUrl(browserEndpoint, { cancellationToken })
    const { valid, message } = validateResponseStatusIsOk(browserResponse)
    if (!valid) {
      throw new Error(message)
    }

    const browserResponseObject = JSON.parse(browserResponse.body)
    const { webSocketDebuggerUrl } = browserResponseObject
    console.log(`Debugger listening on ${webSocketDebuggerUrl}`)
  }

  return {
    browser,
    stopBrowser: stop,
  }
}
