import { startMeasures } from "@jsenv/performance-impact";
import { chromium } from "playwright";

const devServerMetrics = {};

const readyMeasures = startMeasures({
  gc: true,
  memoryHeap: true,
  filesystem: true,
});
const { startDevServer } = await import("@jsenv/core");
const devServer = await startDevServer({
  sourceDirectoryUrl: new URL("./basic_app/", import.meta.url),
  logLevel: "warn",
  keepProcessAlive: false,
  port: 0,
});
const { duration, memoryHeapTotal, memoryHeapUsed, fsStatCall, fsOpenCall } =
  readyMeasures.stop();
Object.assign(devServerMetrics, {
  "start duration": { value: duration, unit: "ms" },
  "start memory heap used": { value: memoryHeapUsed, unit: "byte" },
  "start memory heap total": { value: memoryHeapTotal, unit: "byte" },
  "start fs stat operations": { value: fsStatCall },
  "start fs open operations": { value: fsOpenCall },
});

await new Promise((resolve) => setTimeout(resolve, 500));

const measureAppDisplayed = async ({ appUrl, waitRedirect }) => {
  const browser = await chromium.launch({
    args: [],
  });
  const browserContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await browserContext.newPage();
  await page.goto(appUrl);
  if (waitRedirect) {
    await page.waitForNavigation();
  }
  const { appDisplayedDuration } = await page.evaluate(
    /* eslint-disable no-undef */
    /* istanbul ignore next */
    () => {
      return window.appDisplayedMetricsPromise;
    },
    /* eslint-enable no-undef */
  );
  await browser.close();
  return { appDisplayedDuration };
};

{
  const displayMeasures = startMeasures({
    gc: true,
    memoryHeap: true,
    filesystem: true,
  });
  const { appDisplayedDuration } = await measureAppDisplayed({
    appUrl: `${devServer.origin}/main.html`,
  });
  const { memoryHeapTotal, memoryHeapUsed, fsStatCall, fsOpenCall } =
    displayMeasures.stop();
  Object.assign(devServerMetrics, {
    "time to app display": { value: appDisplayedDuration, unit: "ms" },
    "serve app memory heap total": { value: memoryHeapTotal, unit: "byte" },
    "serve app memory heap used": { value: memoryHeapUsed, unit: "byte" },
    "serve app fs stat": { value: fsStatCall },
    "serve app fs open": { value: fsOpenCall },
  });
  await new Promise((resolve) => setTimeout(resolve, 500));
}

{
  const secondDisplayMeasures = startMeasures({
    gc: true,
    memoryHeap: true,
    filesystem: true,
  });
  const { appDisplayedDuration } = await measureAppDisplayed({
    appUrl: `${devServer.origin}/main.html`,
  });
  const { memoryHeapTotal, memoryHeapUsed, fsStatCall, fsOpenCall } =
    secondDisplayMeasures.stop();
  Object.assign(devServerMetrics, {
    "time to 2nd app display": { value: appDisplayedDuration, unit: "ms" },
    "2nd serve memory heap total": { value: memoryHeapTotal, unit: "byte" },
    "2nd serve memory heap used": { value: memoryHeapUsed, unit: "byte" },
    "2nd serve fs stat": { value: fsStatCall },
    "2nd serve fs open": { value: fsOpenCall },
  });
}

export { devServerMetrics };
