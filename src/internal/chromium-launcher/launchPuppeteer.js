/* eslint-disable import/max-dependencies */
// https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md

import { createCancellationToken, createStoppableOperation } from "@jsenv/cancellation"
import { teardownSignal } from "@jsenv/node-signals"
import { require } from "../require.js"
import { fetchUrl } from "../fetchUrl.js"
import { validateResponseStatusIsOk } from "../validateResponseStatusIsOk.js"
import { trackRessources } from "./trackRessources.js"

/**
 * Be very careful whenever updating puppeteer
 * For instance version 2.1.0 introduced a subtle problem:
 * browser is not properly destroyed when calling stop
 * meaning process can never exit properly.
 *
 * That bug hapenned only on windows (and could reproduce only in github workflow...)
 */
const puppeteer = require("puppeteer")

export const launchPuppeteer = async ({
  cancellationToken = createCancellationToken(),
  headless = true,
  debug = false,
  debugPort = 9222,
  stopOnExit = true,
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
      await browser.close()
      if (browser.isConnected()) {
        await new Promise((resolve) => {
          const disconnectedCallback = () => {
            browser.removeListener("disconnected", disconnectedCallback)
            resolve()
          }
          browser.on("disconnected", disconnectedCallback)
        })
      }
    },
  })
  const { stop } = browserOperation

  if (stopOnExit) {
    const unregisterProcessTeadown = teardownSignal.addCallback((reason) => {
      stop(`process ${reason}`)
    })
    registerCleanupCallback(unregisterProcessTeadown)
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
