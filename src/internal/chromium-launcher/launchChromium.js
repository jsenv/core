// https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md

import { createCancellationToken } from "@dmail/cancellation"
import { trackRessources } from "./ressource-tracker.js"
import { launchPuppeteer } from "./launchPuppeteer.js"
import { startPuppeteerServer } from "./start-puppeteer-server.js"
import { trackPageTargetsToClose } from "./trackPageTargetsToClose.js"
import { trackPageTargetsToNotify } from "./trackPageTargetsToNotify.js"
import { evaluateImportExecution } from "./evaluateImportExecution.js"
import { CHROMIUM_VERSION } from "./constants.js"

export const launchChromium = async ({
  cancellationToken = createCancellationToken(),
  compileServerOrigin,
  projectPath,
  compileIntoRelativePath,
  importMapRelativePath,
  importMapDefaultExtension,
  HTMLTemplateRelativePath,
  puppeteerExecuteTemplateRelativePath,
  babelPluginMap,
  clientServerLogLevel,
  headless = true,
  incognito = false,
  errorStackRemapping = true,
}) => {
  if (typeof compileServerOrigin !== "string")
    throw new TypeError(`compileServerOrigin must be a string, got ${compileServerOrigin}`)
  if (typeof projectPath !== "string")
    throw new TypeError(`projectPath must be a string, got ${projectPath}`)

  const { registerCleanupCallback, cleanup } = trackRessources()

  const [{ browser, stopBrowser }, puppeteerServer] = await Promise.all([
    launchPuppeteer({
      cancellationToken,
      headless,
    }),
    startPuppeteerServer({
      cancellationToken,
      projectPath,
      compileIntoRelativePath,
      importMapRelativePath,
      importMapDefaultExtension,
      HTMLTemplateRelativePath,
      puppeteerExecuteTemplateRelativePath,
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
      projectPath,
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
    version: CHROMIUM_VERSION,
    options: { headless, incognito },
    stop: cleanup,
    registerDisconnectCallback,
    registerErrorCallback,
    registerConsoleCallback,
    executeFile,
  }
}
