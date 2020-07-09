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

  let removeErrorListener
  const errorPromise = new Promise((resolve, reject) => {
    page.on("pageerror", reject)
    removeErrorListener = () => {
      page.removeListener("pageerror", reject)
    }
  })

  const executionResult = await Promise.race([getHtmlExecutionResult(page), errorPromise])
  removeErrorListener()

  if (executionResult.status === "errored") {
    executionResult.error = evalSource(executionResult.exceptionSource)
    delete executionResult.exceptionSource
  }

  if (inheritCoverage) {
    const { coverageMap } = executionResult
    global.__coverage__ = composeCoverageMap(global.__coverage__ || {}, coverageMap || {})
    delete executionResult.coverageMap
    const { fileExecutionResultMap } = executionResult
    Object.keys(fileExecutionResultMap).forEach((file) => {
      const fileExecutionResult = fileExecutionResultMap[file]
      delete fileExecutionResult.coverageMap
    })
  }

  return {
    browser,
    page,
    pageErrors,
    pageLogs,
    executionResult,
  }
}

export const getHtmlExecutionResult = async (page) => {
  // await page.waitForFunction(() => {
  //   /* istanbul ignore next */
  //   return Boolean(window.__jsenv__)
  // })
  return page.evaluate(
    /* istanbul ignore next */
    () => {
      return window.__jsenv__.executionResultPromise
    },
  )
}
