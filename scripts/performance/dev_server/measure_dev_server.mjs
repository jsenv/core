import { chromium } from "playwright"
import { startMeasures } from "@jsenv/performance-impact"

const devServerMetrics = {}

const serverStartMeasures = startMeasures()
const { startDevServer } = await import("@jsenv/core")
const devServer = await startDevServer({
  rootDirectoryUrl: new URL("./basic_app/", import.meta.url),
  logLevel: "warn",
  protocol: "http",
  keepProcessAlive: false,
  devServerAutoreload: false,
})
const { duration } = serverStartMeasures.stop()
devServerMetrics["time to start dev server"] = {
  value: duration,
  unit: "ms",
}
await new Promise((resolve) => setTimeout(resolve, 500))

const measureAppDisplayed = async ({ appUrl, waitRedirect }) => {
  const browser = await chromium.launch({
    args: [],
  })
  const browserContext = await browser.newContext({ ignoreHTTPSErrors: true })
  const page = await browserContext.newPage()
  await page.goto(appUrl)
  if (waitRedirect) {
    await page.waitForNavigation()
  }
  const { appDisplayedDuration } = await page.evaluate(
    /* eslint-disable no-undef */
    /* istanbul ignore next */
    () => {
      return window.appDisplayedMetricsPromise
    },
    /* eslint-enable no-undef */
  )
  await browser.close()
  return { appDisplayedDuration }
}

{
  const { appDisplayedDuration } = await measureAppDisplayed({
    appUrl: `${devServer.origin}/main.html`,
  })
  devServerMetrics["time to display app using source files"] = {
    value: appDisplayedDuration,
    unit: "ms",
  }
  await new Promise((resolve) => setTimeout(resolve, 500))
}

{
  const { appDisplayedDuration } = await measureAppDisplayed({
    appUrl: `${devServer.origin}/main.html`,
  })
  devServerMetrics["time to display app second visit"] = {
    value: appDisplayedDuration,
    unit: "ms",
  }
}

export { devServerMetrics }
