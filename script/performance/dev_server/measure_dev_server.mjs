import { chromium } from "playwright"
import {
  ensureEmptyDirectory,
  urlToRelativeUrl,
  resolveUrl,
} from "@jsenv/filesystem"
import { startMeasures } from "@jsenv/performance-impact"

const devServerMetrics = {}

const projectDirectoryUrl = new URL("../../../", import.meta.url)
const directoryRelativeUrl = urlToRelativeUrl(
  new URL("./", import.meta.url),
  projectDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${directoryRelativeUrl}.jsenv/`
const jsenvDirectoryUrl = resolveUrl(
  jsenvDirectoryRelativeUrl,
  projectDirectoryUrl,
)
await ensureEmptyDirectory(jsenvDirectoryUrl)

const serverStartMeasures = startMeasures()
const { startDevServer } = await import("@jsenv/core")
const devServer = await startDevServer({
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  logLevel: "warn",
  protocol: "http",
  keepProcessAlive: false,
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
// for some reason I have to do this to make perf metrics more reliable
// as if playwright sometimes have to warmup
await measureAppDisplayed({
  appUrl: `${devServer.origin}/${directoryRelativeUrl}basic_app/main.html`,
})
await new Promise((resolve) => setTimeout(resolve, 500))

{
  const { appDisplayedDuration } = await measureAppDisplayed({
    appUrl: `${devServer.origin}/${directoryRelativeUrl}basic_app/main.html`,
  })
  devServerMetrics["time to display app using source files"] = {
    value: appDisplayedDuration,
    unit: "ms",
  }
  await new Promise((resolve) => setTimeout(resolve, 500))
}

{
  const { appDisplayedDuration } = await measureAppDisplayed({
    appUrl: `${devServer.origin}/${devServer.jsenvDirectoryRelativeUrl}redirect/${directoryRelativeUrl}basic_app/main.html`,
    waitRedirect: true,
  })
  devServerMetrics["time to display app using compiled files"] = {
    value: appDisplayedDuration,
    unit: "ms",
  }
  await new Promise((resolve) => setTimeout(resolve, 500))
}

{
  const { appDisplayedDuration } = await measureAppDisplayed({
    appUrl: `${devServer.origin}/${devServer.jsenvDirectoryRelativeUrl}redirect/${directoryRelativeUrl}basic_app/main.html`,
    waitRedirect: true,
  })
  devServerMetrics["time to display app compiled and second visit"] = {
    value: appDisplayedDuration,
    unit: "ms",
  }
}

export { devServerMetrics }
