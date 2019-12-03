import { composeCoverageMap } from "internal/executing/coverage/composeCoverageMap.js"
import { evalSource } from "internal/platform/createNodePlatform/evalSource.js"

const puppeteer = import.meta.require("puppeteer")

export const openBrowserPage = async (
  url,
  {
    headless = true,
    inheritCoverage = process.env.COVERAGE_ENABLED === "true",
    collectConsole = true,
    collectErrors = true,
  } = {},
) => {
  const browser = await puppeteer.launch({
    headless,
  })
  const page = await browser.newPage()

  const pageLogs = []
  if (collectConsole) {
    page.on("console", (message) => {
      pageLogs.push({ type: message.type(), text: message.text() })
    })
  }

  const pageErrors = []
  if (collectErrors) {
    page.on("pageerror", (error) => {
      pageErrors.push(error)
    })
  }

  await page.goto(url)
  await page.waitFor(
    /* istanbul ignore next */
    () => Boolean(window.__executionResult__),
  )

  const executionResult = await page.evaluate(
    /* istanbul ignore next */
    () => window.__executionResult__,
  )

  if (executionResult.status === "errored") {
    executionResult.error = evalSource(executionResult.exceptionSource)
    delete executionResult.exceptionSource
  }

  if (inheritCoverage) {
    const { coverageMap } = executionResult
    global.__coverage__ = composeCoverageMap(global.__coverage__ || {}, coverageMap || {})
    delete executionResult.coverageMap
  }

  return {
    browser,
    page,
    pageErrors,
    pageLogs,
    executionResult,
  }
}
