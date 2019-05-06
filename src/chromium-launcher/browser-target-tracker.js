import { trackRessources } from "./ressource-tracker.js"

export const trackBrowserTargets = (browser) => {
  const { registerCleanupCallback, cleanup } = trackRessources()

  const targetcreatedCallback = (target) => {
    const type = target.type()

    if (type === "browser") {
      const childBrowser = target.browser()
      const childTargetTracker = trackBrowserTargets(childBrowser)
      registerCleanupCallback(childTargetTracker.stop)
    }

    if (type === "page" || type === "background_page") {
      // in case of bug do not forget https://github.com/GoogleChrome/puppeteer/issues/2269
      registerCleanupCallback(async () => {
        const page = await target.page()
        return page.close()
      })
    }
  }

  // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#class-target
  browser.on("targetcreated", targetcreatedCallback)
  registerCleanupCallback(() => {
    browser.removeListener("targetcreated", targetcreatedCallback)
  })

  return { stop: cleanup }
}
