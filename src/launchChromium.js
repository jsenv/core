// https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md

import { createCancellationToken } from "@jsenv/cancellation"
import { jsenvHtmlFileUrl } from "internal/jsenvHtmlFileUrl.js"
import { closePage } from "internal/chromium-launcher/closePage.js"
import { trackRessources } from "internal/chromium-launcher/trackRessources.js"
import { launchPuppeteer } from "internal/chromium-launcher/launchPuppeteer.js"
import { startChromiumServer } from "internal/chromium-launcher/startChromiumServer.js"
import { trackPageTargetsToClose } from "internal/chromium-launcher/trackPageTargetsToClose.js"
import { trackPageTargetsToNotify } from "internal/chromium-launcher/trackPageTargetsToNotify.js"
import { evaluateImportExecution } from "internal/chromium-launcher/evaluateImportExecution.js"
import { createSharing } from "internal/chromium-launcher/createSharing.js"

const browserSharing = createSharing()
const executionServerSharing = createSharing()

export const launchChromium = async ({
  cancellationToken = createCancellationToken(),
  clientServerLogLevel,

  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,

  headless = true,
  shareBrowser = false,
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`)
  }
  if (typeof compileServerOrigin !== "string") {
    throw new TypeError(`compileServerOrigin must be a string, got ${compileServerOrigin}`)
  }

  const { registerCleanupCallback, cleanup } = trackRessources()

  const sharingToken = shareBrowser
    ? browserSharing.getSharingToken({ headless })
    : browserSharing.getUniqueSharingToken()
  if (!sharingToken.isUsed()) {
    const value = launchPuppeteer({
      cancellationToken,
      headless,
    })
    sharingToken.setSharedValue(value, async () => {
      const { stopBrowser } = await value
      await stopBrowser()
    })
  }
  const [browserPromise, stopUsingBrowser] = sharingToken.useSharedValue()
  registerCleanupCallback((reason) => {
    if (shareBrowser && reason === "intermediate-execution-done") {
      // keep the browser except if this is the last execution
      // don't worry browser will also be killed if it's not the last execution
      // thanks to a dedicated cancellation source inside executeConcurrently
      // that is cancelling everything related to execution when execution are done
      return
    }
    stopUsingBrowser()
  })
  const { browser } = await browserPromise

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
      htmlFileUrl = jsenvHtmlFileUrl,
      incognito = false,
      collectNamespace,
      collectCoverage,
      executionId,
      errorStackRemapping = true,
    },
  ) => {
    const sharingToken = executionServerSharing.getSharingToken()
    if (!sharingToken.isUsed()) {
      const executionServerPromise = startChromiumServer({
        cancellationToken,
        logLevel: clientServerLogLevel,

        projectDirectoryUrl,
        outDirectoryRelativeUrl,
        compileServerOrigin,
      })
      sharingToken.setSharedValue(executionServerPromise, async () => {
        const server = await executionServerPromise
        await server.stop()
      })
    }
    const [executionServerPromise, stopUsingExecutionServer] = sharingToken.useSharedValue()
    registerCleanupCallback(stopUsingExecutionServer)
    const executionServer = await executionServerPromise

    // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#browsercreateincognitobrowsercontext
    const browserContextPromise = incognito
      ? browser.createIncognitoBrowserContext()
      : browser.defaultBrowserContext()

    const browserContext = await browserContextPromise
    const page = await browserContext.newPage()

    if (incognito || !shareBrowser) {
      // in incognito mode, browser context is not shared by tabs
      // it means if a tab open an other page/tab we'll know
      // it comes form that tab and not an other one

      // when browser is not shared we know an opened page comes from
      // that execution
      const stopTrackingToClose = trackPageTargetsToClose(page)
      registerCleanupCallback(stopTrackingToClose)
      registerCleanupCallback(() => closePage(page))
    } else {
      // when browser is shared and execution happens in the default
      // browser context (not incognito)
      // we'll only try to close the tab we created
      // otherwise we might kill tab opened by potential parallel execution.
      // A consequence might be to leave opened tab alive
      // (it means js execution opens an other tab, not supposed to happen a lot)
      registerCleanupCallback(() => closePage(page))
    }

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
      trackOtherPages: incognito || !shareBrowser,
    })
    registerCleanupCallback(stopTrackingToNotify)

    return evaluateImportExecution({
      cancellationToken,

      projectDirectoryUrl,
      outDirectoryRelativeUrl,
      htmlFileUrl,
      fileRelativeUrl,
      compileServerOrigin,
      executionServerOrigin: executionServer.origin,

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
