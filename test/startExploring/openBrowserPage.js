import { require } from "../../src/internal/require.js"
import { composeCoverageMap } from "../../src/internal/executing/coverage/composeCoverageMap.js"
import { evalSource } from "../../src/internal/runtime/createNodeRuntime/evalSource.js"
import { coverageIsEnabled } from "../coverageIsEnabled.js"

const { chromium } = require("playwright-chromium")

export const openBrowserPage = async (
  url,
  {
    headless = true,
    inheritCoverage = coverageIsEnabled(),
    collectConsole = true,
    collectErrors = true,
  } = {},
) => {
  const browser = await chromium.launch({
    headless,
  })
  const page = await browser.newPage({ ignoreHTTPSErrors: true })

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
