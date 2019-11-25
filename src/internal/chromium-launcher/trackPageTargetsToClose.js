import { trackPageTargets } from "./trackPageTargets.js"

export const trackPageTargetsToClose = (page) => {
  return trackPageTargets(page, ({ target, type }) => {
    if (type === "browser") return null

    if (type === "page" || type === "background_page") {
      // in case of bug do not forget https://github.com/GoogleChrome/puppeteer/issues/2269
      return async () => {
        const page = await target.page()
        return page.close()
      }
    }

    return null
  })
}
