// https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md

import { createCancellationToken } from "@jsenv/cancellation"
import { trackRessources } from "internal/chromium-launcher/trackRessources.js"
import { launchPuppeteer } from "internal/chromium-launcher/launchPuppeteer.js"
import { startPuppeteerServer } from "internal/chromium-launcher/startPuppeteerServer.js"
import { trackPageTargetsToClose } from "internal/chromium-launcher/trackPageTargetsToClose.js"
import { trackPageTargetsToNotify } from "internal/chromium-launcher/trackPageTargetsToNotify.js"
import { evaluateImportExecution } from "internal/chromium-launcher/evaluateImportExecution.js"

export const launchChromium = async ({
  cancellationToken = createCancellationToken(),

  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,

  HTMLTemplateFileUrl,
  puppeteerExecuteTemplateFileUrl,

  babelPluginMap,
  clientServerLogLevel,
  headless = true,
  incognito = false,
  errorStackRemapping = true,
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`)
  }
  if (typeof compileServerOrigin !== "string") {
    throw new TypeError(`compileServerOrigin must be a string, got ${compileServerOrigin}`)
  }
  if (typeof jsenvDirectoryRelativeUrl !== "string") {
    throw new TypeError(
      `jsenvDirectoryRelativeUrl must be a string, got ${jsenvDirectoryRelativeUrl}`,
    )
  }
  if (typeof outDirectoryRelativeUrl !== "string") {
    throw new TypeError(`outDirectoryRelativeUrl must be a string, got ${outDirectoryRelativeUrl}`)
  }

  const { registerCleanupCallback, cleanup } = trackRessources()

  const [{ browser, stopBrowser }, puppeteerServer] = await Promise.all([
    launchPuppeteer({
      cancellationToken,
      headless,
    }),
    startPuppeteerServer({
      cancellationToken,

      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,

      HTMLTemplateFileUrl,
      puppeteerExecuteTemplateFileUrl,

      babelPluginMap,
      logLevel: clientServerLogLevel,
    }),
  ])
  registerCleanupCallback(stopBrowser)
  registerCleanupCallback(puppeteerServer.stop)

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
    fileRelativePath,
    { collectNamespace, collectCoverage, executionId },
  ) => {
    // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#browsercreateincognitobrowsercontext
    const browserContext = incognito
      ? await browser.createIncognitoBrowserContext()
      : browser.defaultBrowserContext()

    const page = await browserContext.newPage()

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
      trackOtherPages: true,
    })
    registerCleanupCallback(stopTrackingToNotify)

    return evaluateImportExecution({
      cancellationToken,
      projectDirectoryUrl,
      page,
      compileServerOrigin,
      puppeteerServerOrigin: puppeteerServer.origin,
      fileRelativePath,
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
    version: "78.0.3882.0",
    options: { headless, incognito },
    stop: cleanup,
    registerDisconnectCallback,
    registerErrorCallback,
    registerConsoleCallback,
    executeFile,
  }
}
