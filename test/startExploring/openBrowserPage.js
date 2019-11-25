import { composeCoverageMap } from "internal/executing/coverage/composeCoverageMap.js"

const puppeteer = import.meta.require("puppeteer")

export const openBrowserPage = async (
  url,
  {
    inheritCoverage = process.env.COVERAGE_ENABLED === "true",
    collectCoverage = false,
    collectNamespace = true,
  } = {},
) => {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  await page.goto(url)

  let coverageMap
  if (inheritCoverage || collectCoverage) {
    coverageMap = await page.evaluate(`(() => {
  return window.__coverage__
})()`)
    global.__coverage__ = composeCoverageMap(global.__coverage__ || {}, coverageMap || {})
    if (!collectCoverage) {
      coverageMap = undefined
    }
  }

  let namespace
  if (collectNamespace) {
    namespace = await page.evaluate(`() => {
  return window.__namespace__
})()`)
  }

  return { browser, page, coverageMap, namespace }
}
