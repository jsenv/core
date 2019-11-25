/* eslint-disable import/max-dependencies */
// https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md

import { createCancellationToken, createStoppableOperation } from "@dmail/cancellation"
import {
  registerProcessInterruptCallback,
  registerUngaranteedProcessTeardown,
} from "@dmail/process-signals"
import { trackRessources } from "./ressource-tracker.js"

const puppeteer = import.meta.require("puppeteer")

export const launchPuppeteer = async ({
  cancellationToken = createCancellationToken(),
  headless = true,
  stopOnExit = true,
  stopOnSIGINT = true,
}) => {
  const options = {
    headless,
    // because we use a self signed certificate
    ignoreHTTPSErrors: true,
    args: [
      // https://github.com/GoogleChrome/puppeteer/issues/1834
      // https://github.com/GoogleChrome/puppeteer/blob/master/docs/troubleshooting.md#tips
      // "--disable-dev-shm-usage",
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
    const unregisterProcessTeadown = registerUngaranteedProcessTeardown((reason) => {
      stop(`process ${reason}`)
    })
    registerCleanupCallback(unregisterProcessTeadown)
  }
  if (stopOnSIGINT) {
    const unregisterProcessInterrupt = registerProcessInterruptCallback(() => {
      stop("process sigint")
    })
    registerCleanupCallback(unregisterProcessInterrupt)
  }

  const browser = await browserOperation

  return { browser, stopBrowser: stop }
}
