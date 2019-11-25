// https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md

import { createCancellationToken } from "@jsenv/cancellation"
import { resolveUrl } from "internal/urlUtils.js"
import { assertFileExists } from "internal/filesystemUtils.js"
import { trackRessources } from "internal/chromium-launcher/trackRessources.js"
import { launchPuppeteer } from "internal/chromium-launcher/launchPuppeteer.js"
import { startChromiumServer } from "internal/chromium-launcher/startChromiumServer.js"
import { trackPageTargetsToClose } from "internal/chromium-launcher/trackPageTargetsToClose.js"
import { trackPageTargetsToNotify } from "internal/chromium-launcher/trackPageTargetsToNotify.js"
import { evaluateImportExecution } from "internal/chromium-launcher/evaluateImportExecution.js"

export const launchChromium = async ({
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
  if (typeof chromiumHtmlFileUrl === "undefined") {
    chromiumHtmlFileUrl = resolveUrl(
      "./src/internal/chromium-launcher/chromium-html-file.html",
      projectDirectoryUrl,
    )
  }
  if (!chromiumHtmlFileUrl.startsWith(projectDirectoryUrl)) {
    throw new Error(`chromium html file must be inside project directory
--- chromium html file url ---
${chromiumHtmlFileUrl}
--- project directory url ---
${chromiumHtmlFileUrl}`)
  }
  await assertFileExists(chromiumHtmlFileUrl)

  if (typeof chromiumJsFileUrl === "undefined") {
    chromiumJsFileUrl = resolveUrl("./helpers/chromium/chromium-js-file.js", projectDirectoryUrl)
  }
  if (!chromiumJsFileUrl.startsWith(projectDirectoryUrl)) {
    throw new Error(`chromium js file must be inside project directory
--- chromium js file url ---
${chromiumJsFileUrl}
--- project directory url ---
${projectDirectoryUrl}`)
  }
  await assertFileExists(chromiumJsFileUrl)
  if (typeof compileServerOrigin !== "string") {
    throw new TypeError(`compileServerOrigin must be a string, got ${compileServerOrigin}`)
  }

  const { registerCleanupCallback, cleanup } = trackRessources()

  const [{ browser, stopBrowser }, chromiumServer] = await Promise.all([
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
  registerCleanupCallback(stopBrowser)
  registerCleanupCallback(chromiumServer.stop)

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
      incognito = false,
      errorStackRemapping = true,
    },
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
