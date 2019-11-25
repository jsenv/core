// https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md

import { createCancellationToken } from "@jsenv/cancellation"
import { trackRessources } from "internal/chromium-launcher/trackRessources.js"
import { launchPuppeteer } from "internal/chromium-launcher/launchPuppeteer.js"
import { startChromiumServer } from "internal/chromium-launcher/startChromiumServer.js"
import { trackPageTargetsToClose } from "internal/chromium-launcher/trackPageTargetsToClose.js"
import { trackPageTargetsToNotify } from "internal/chromium-launcher/trackPageTargetsToNotify.js"
import { evaluateImportExecution } from "internal/chromium-launcher/evaluateImportExecution.js"
import { shareRessource } from "internal/chromium-launcher/shareRessource.js"

let sharedRessource

export const launchChromiumTab = async ({
  cancellationToken = createCancellationToken(),
  clientServerLogLevel,

  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  chromiumHtmlFileUrl,
  chromiumJsFileUrl,
  compileServerOrigin,

  headless = true,
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`)
  }
  if (typeof compileServerOrigin !== "string") {
    throw new TypeError(`compileServerOrigin must be a string, got ${compileServerOrigin}`)
  }
  if (typeof outDirectoryRelativeUrl !== "string") {
    throw new TypeError(`outDirectoryRelativeUrl must be a string, got ${outDirectoryRelativeUrl}`)
  }

  const { registerCleanupCallback, cleanup } = trackRessources()

  // share chromium and puppeteerServer
  if (!sharedRessource) {
    sharedRessource = shareRessource({
      start: () => {
        return Promise.all([
          launchPuppeteer({
            cancellationToken,
            headless,
          }),
          startChromiumServer({
            cancellationToken,
            logLevel: clientServerLogLevel,

            projectDirectoryUrl,
            chromiumHtmlFileUrl,
            chromiumJsFileUrl,
          }),
        ])
      },
      stop: async (ressource) => {
        const [{ stopBrowser }, chromiumServer] = await ressource
        await Promise.all([stopBrowser(), chromiumServer.stop()])
      },
    })
  }
  const { ressource, stopUsing } = sharedRessource.startUsing()
  registerCleanupCallback(stopUsing)
  const [{ browser }, chromiumServer] = await ressource

  const registerDisconnectCallback = (callback) => {
    // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-disconnected
    browser.on("disconnected", callback)
    registerCleanupCallback(() => {
      browser.removeListener("disconnected", callback)
    })
  }

  const errorCallbackArray = []
  const registerErrorCallback = (callback) => {
    errorCallbackArray.push(callback)
  }

  const consoleCallbackArray = []
  const registerConsoleCallback = (callback) => {
    consoleCallbackArray.push(callback)
  }

  const executeFile = async (
    fileRelativeUrl,
    {
      collectNamespace,
      collectCoverage,
      executionId,
      // if we create an incognito context for every execution
      // browser cache is not shared, and it might impact badly perf.
      // (TO BE TESTED)
      incognito = false,
      errorStackRemapping = true,
    },
  ) => {
    // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#browsercreateincognitobrowsercontext
    const browserContext = incognito
      ? await browser.createIncognitoBrowserContext()
      : browser.defaultBrowserContext()

    const page = await browserContext.newPage()

    // in incognito mode, browser context is not shared by tabs
    // it means if a tab open an other page/tab we'll know
    // it comes form that tab and not an other one
    if (incognito) {
      const stopTrackingToClose = trackPageTargetsToClose(page)
      registerCleanupCallback(stopTrackingToClose)
      registerCleanupCallback(() => page.close())
    }
    // in non incognito mode
    // we'll only try to close the tab we created
    // otherwise we might kill tab opened by potential parallel execution.
    // A consequence might be to leave opened tab alive
    // (it means js execution opens an other tab, not supposed to happen a lot)
    else {
      registerCleanupCallback(() => page.close())
    }

    const stopTrackingToClose = trackPageTargetsToClose(page)
    registerCleanupCallback(stopTrackingToClose)

    const stopTrackingToNotify = trackPageTargetsToNotify(page, {
      onError: (error) => {
        errorCallbackArray.forEach((callback) => {
          callback(error)
        })
      },
      onConsole: ({ type, text }) => {
        consoleCallbackArray.forEach((callback) => {
          callback({ type, text })
        })
      },
      // we track other pages only in incognito mode because
      // we know for sure opened tabs comes from this one
      // and not from a potential parallel execution
      trackOtherPages: incognito,
    })
    registerCleanupCallback(stopTrackingToNotify)

    return evaluateImportExecution({
      cancellationToken,

      projectDirectoryUrl,
      outDirectoryRelativeUrl,
      fileRelativeUrl,
      compileServerOrigin,
      chromiumServerOrigin: chromiumServer.origin,

      page,

      collectNamespace,
      collectCoverage,
      executionId,
      errorStackRemapping,
    })
  }

  return {
    name: "chromium",
    // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#puppeteer-api-tip-of-tree
    // https://github.com/GoogleChrome/puppeteer#q-why-doesnt-puppeteer-vxxx-work-with-chromium-vyyy
    // to keep in sync when updating puppeteer
    version: "79.0.3942.0",
    options: { headless },
    stop: cleanup,
    registerDisconnectCallback,
    registerErrorCallback,
    registerConsoleCallback,
    executeFile,
  }
}
