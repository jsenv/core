import { createCancellationToken, composeCancellationToken } from "@jsenv/cancellation"
import { trackRessources } from "./trackRessources.js"
import { startPuppeteerServer } from "./startPuppeteerServer.js"
import { launchPuppeteer } from "./launchPuppeteer.js"
import { trackPageTargetsToClose } from "./trackPageTargetsToClose.js"
import { trackPageTargetsToNotify } from "./trackPageTargetsToNotify.js"
import { evaluateImportExecution } from "./evaluateImportExecution.js"

export const launchChromiumToLaunchTab = async ({
  cancellationToken = createCancellationToken(),
  projectPath,
  compileIntoRelativePath = "/.dist",
  importMapRelativePath = "/importMap.json",
  importMapDefaultExtension,
  HTMLTemplateRelativePath,
  puppeteerExecuteTemplateRelativePath,
  babelPluginMap,
  clientServerLogLevel,
  headless = true,
}) => {
  if (typeof projectPath !== "string")
    throw new TypeError(`projectPath must be a string, got ${projectPath}`)

  const chromiumRessourceTracker = trackRessources()

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
  chromiumRessourceTracker.registerCleanupCallback(stopBrowser)
  chromiumRessourceTracker.registerCleanupCallback(puppeteerServer.stop)

  const launchChromiumTab = ({
    cancellationToken: launchCancellationToken,
    compileServerOrigin,
    // if we create an incognito context for every execution
    // browser cache is not shared, and it might impact badly perf.
    // (TO BE TESTED)
    incognito = false,
  }) => {
    if (typeof compileServerOrigin !== "string")
      throw new TypeError(`compileServerOrigin must be a string, got ${compileServerOrigin}`)

    const tabRessourceTracker = trackRessources()

    if (typeof launchCancellationToken === undefined) {
      launchCancellationToken = cancellationToken
    } else {
      launchCancellationToken = composeCancellationToken(cancellationToken, launchCancellationToken)
    }

    const registerDisconnectCallback = (callback) => {
      // should we also listen for targetdestroyed ?
      // because if target is destroyed too early we
      // are indeed disconnected from the page
      browser.on("disconnected", callback)
      tabRessourceTracker.registerCleanupCallback(() => {
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
      const browserContext = incognito
        ? await browser.createIncognitoBrowserContext()
        : browser.defaultBrowserContext()

      const page = await browserContext.newPage()

      // in incognito mode, browser context is not shared
      // by tabs
      // it means if a tab open an other page/tab we'll know
      // it comes form that tab and not an other one
      if (incognito) {
        const stopTrackingToClose = trackPageTargetsToClose(page)
        tabRessourceTracker.registerCleanupCallback(stopTrackingToClose)
        tabRessourceTracker.registerCleanupCallback(() => page.close())
      }
      // in non incognito mode
      // we'll only try to close the tab we created
      // otherwise we might kill tab opened by potential parallel execution.
      // A consequence might be to leave opened tab alive
      // (it means js execution opens an other tab, not supposed to happen a lot)
      else {
        tabRessourceTracker.registerCleanupCallback(() => page.close())
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
        trackOtherPages: incognito,
      })
      tabRessourceTracker.registerCleanupCallback(stopTrackingToNotify)

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
      })
    }

    return {
      name: "chromium",
      version: null, // todo
      options: { headless, incognito },
      stop: tabRessourceTracker.cleanup,
      registerDisconnectCallback,
      registerErrorCallback,
      registerConsoleCallback,
      executeFile,
    }
  }

  return { launchChromiumTab, stop: chromiumRessourceTracker.cleanup }
}
