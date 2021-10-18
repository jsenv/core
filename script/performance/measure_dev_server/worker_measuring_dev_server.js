import { parentPort } from "node:worker_threads"
import {
  ensureEmptyDirectory,
  urlToRelativeUrl,
  resolveUrl,
} from "@jsenv/filesystem"
import { chromium } from "playwright"

import { startMeasuring } from "../start_measuring.js"

const metrics = {}

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

const startMeasure = startMeasuring()
const { startExploring } = await import("@jsenv/core")
const devServer = await startExploring({
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  compileServerLogLevel: "warn",
  compileServerProtocol: "http",
  keepProcessAlive: false,
})
const { msEllapsed } = startMeasure.stop()
metrics.timeToStartDevServer = msEllapsed
await new Promise((resolve) => setTimeout(resolve, 500))

const browser = await chromium.launch({
  args: [],
})

const measureAppDisplayed = async ({ appUrl }) => {
  const browserContext = await browser.newContext({ ignoreHTTPSErrors: true })
  const page = await browserContext.newPage()
  // disable cache otherwise it influences perf measures
  page.route("**", (route) => route.continue())
  await page.goto(appUrl)

  const { appDisplayedDuration } = await page.evaluate(
    /* istanbul ignore next */
    () => {
      // eslint-disable-next-line no-undef
      return window.appDisplayedMetricsPromise
    },
  )

  await browserContext.close()

  return { appDisplayedDuration }
}

{
  const { appDisplayedDuration } = await measureAppDisplayed({
    appUrl: `${devServer.origin}/${directoryRelativeUrl}basic_app/main.html`,
  })
  metrics.timeToDisplayAppUsingSourceFiles = appDisplayedDuration
  await new Promise((resolve) => setTimeout(resolve, 500))
}

{
  const { appDisplayedDuration } = await measureAppDisplayed({
    appUrl: `${devServer.origin}/${devServer.outDirectoryRelativeUrl}best/${directoryRelativeUrl}basic_app/main.html`,
  })
  metrics.timeToDisplayAppUsingCompiledFiles = appDisplayedDuration
  await new Promise((resolve) => setTimeout(resolve, 500))
}

{
  const { appDisplayedDuration } = await measureAppDisplayed({
    appUrl: `${devServer.origin}/${devServer.outDirectoryRelativeUrl}best/${directoryRelativeUrl}basic_app/main.html`,
  })
  metrics.timeToDisplayAppCompiledAndSecondVisit = appDisplayedDuration
}

await browser.close()

parentPort.postMessage({
  ...metrics,
})
