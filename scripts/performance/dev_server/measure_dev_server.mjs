import { chromium } from "playwright"
import { startMeasures } from "@jsenv/performance-impact"

const devServerMetrics = {}

const readyMeasures = startMeasures({
  gc: true,
  memoryHeap: true,
  filesystem: true,
})
const { startDevServer } = await import("@jsenv/core")
const devServer = await startDevServer({
  rootDirectoryUrl: new URL("./basic_app/", import.meta.url),
  logLevel: "warn",
  protocol: "http",
  keepProcessAlive: false,
})
const readyMetrics = readyMeasures.stop()
Object.assign(devServerMetrics, {
  "start duration": { value: readyMetrics.duration, unit: "ms" },
  "start memory heap total": {
    value: readyMetrics.memoryHeapTotal,
    unit: "byte",
  },
  "start memory heap used": {
    value: readyMetrics.memoryHeapUsed,
    unit: "byte",
  },
  "start fs read": { value: readyMetrics.fsRead },
  "start fs write": { value: readyMetrics.fsWrite },
})

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
  const displayMeasures = startMeasures({
    gc: true,
    memoryHeap: true,
    filesystem: true,
  })
  const { appDisplayedDuration } = await measureAppDisplayed({
    appUrl: `${devServer.origin}/main.html`,
  })
  const displayMetrics = displayMeasures.stop()
  Object.assign(devServerMetrics, {
    "time to app display": { value: appDisplayedDuration, unit: "ms" },
    "serve app memory heap total": {
      value: displayMetrics.memoryHeapTotal,
      unit: "byte",
    },
    "serve app memory heap used": {
      value: displayMetrics.memoryHeapUsed,
      unit: "byte",
    },
    "serve app fs read": { value: displayMetrics.fsRead },
    "serve app fs write": { value: displayMetrics.fsWrite },
  })
  await new Promise((resolve) => setTimeout(resolve, 500))
}

{
  const secondDisplayMeasures = startMeasures({
    gc: true,
    memoryHeap: true,
    filesystem: true,
  })
  const { appDisplayedDuration } = await measureAppDisplayed({
    appUrl: `${devServer.origin}/main.html`,
  })
  const secondDisplayMetrics = secondDisplayMeasures.stop()
  Object.assign(devServerMetrics, {
    "time to 2nd app display": { value: appDisplayedDuration, unit: "ms" },
    "2nd serve memory heap total": {
      value: secondDisplayMetrics.memoryHeapTotal,
      unit: "byte",
    },
    "2nd serve memory heap used": {
      value: secondDisplayMetrics.memoryHeapUsed,
      unit: "byte",
    },
    "2nd serve fs read": { value: secondDisplayMetrics.fsRead },
    "2nd serve fs write": { value: secondDisplayMetrics.fsWrite },
  })
}

export { devServerMetrics }
