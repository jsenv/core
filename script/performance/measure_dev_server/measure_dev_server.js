import {
  ensureEmptyDirectory,
  urlToRelativeUrl,
  resolveUrl,
} from "@jsenv/filesystem"
import { chromium } from "playwright"
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
const { startExploring } = await import("@jsenv/core")
const devServer = await startExploring({
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  compileServerLogLevel: "warn",
  compileServerProtocol: "http",
  keepProcessAlive: false,
})
const { duration } = serverStartMeasures.stop()
devServerMetrics["time to start dev server"] = {
  value: duration,
  unit: "ms",
}
await new Promise((resolve) => setTimeout(resolve, 500))

const measureAppDisplayed = async ({ appUrl }) => {
  const browser = await chromium.launch({
    args: [],
  })
  const browserContext = await browser.newContext({ ignoreHTTPSErrors: true })
  const page = await browserContext.newPage()
  await page.goto(appUrl)

  const { appDisplayedDuration } = await page.evaluate(
    /* istanbul ignore next */
    () => {
      // eslint-disable-next-line no-undef
      return window.appDisplayedMetricsPromise
    },
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
    appUrl: `${devServer.origin}/${devServer.outDirectoryRelativeUrl}best/${directoryRelativeUrl}basic_app/main.html`,
  })
  devServerMetrics["time to display app using compiled files"] = {
    value: appDisplayedDuration,
    unit: "ms",
  }
  await new Promise((resolve) => setTimeout(resolve, 500))
}

{
  const { appDisplayedDuration } = await measureAppDisplayed({
    appUrl: `${devServer.origin}/${devServer.outDirectoryRelativeUrl}best/${directoryRelativeUrl}basic_app/main.html`,
  })
  devServerMetrics["time to display app compiled and second visit"] = {
    value: appDisplayedDuration,
    unit: "ms",
  }
}

export { devServerMetrics }
