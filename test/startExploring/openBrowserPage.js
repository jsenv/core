import { composeCoverageMap } from "internal/executing/coverage/composeCoverageMap.js"

const puppeteer = import.meta.require("puppeteer")

export const openBrowserPage = async (
  url,
  {
    inheritCoverage = process.env.COVERAGE_ENABLED === "true",
    collectCoverage = false,
    collectValue = true,
  } = {},
) => {
  const browser = await puppeteer.launch({
    headless: false,
  })
  const page = await browser.newPage()
  await page.goto(url)
  await page.waitFor(
    /* istanbul ignore next */
    () => Boolean(window.__done__),
  )

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

  let value
  if (collectValue) {
    value = await page.evaluate(`(() => {
  return window.__value__
})()`)
  }

  return { browser, page, coverageMap, value }
}
