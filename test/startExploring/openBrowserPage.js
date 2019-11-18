import { composeCoverageMap } from "internal/executing/coverage/composeCoverageMap.js"

const puppeteer = import.meta.require("puppeteer")

export const openBrowserPage = async (url) => {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  await page.goto(url)

  if (process.env.COVERAGE_ENABLED === "true") {
    const coverageMap = await page.evaluate(`(() => {
  return window.__coverage__
})()`)
    global.__coverage__ = composeCoverageMap(global.__coverage__ || {}, coverageMap || {})
  }

  return { browser, page }
}
