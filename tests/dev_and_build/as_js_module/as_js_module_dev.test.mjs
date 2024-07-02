import { chromium, firefox } from "playwright";
import { assert } from "@jsenv/assert";

import { startDevServer } from "@jsenv/core";
import { launchBrowserPage } from "@jsenv/core/tests/launch_browser_page.js";

const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  port: 0,
});

const test = async ({ browserLauncher }) => {
  const browser = await browserLauncher.launch({ headless: true });
  try {
    const page = await launchBrowserPage(browser);
    await page.goto(`${devServer.origin}/main.html`);
    const result = await page.evaluate(
      /* eslint-disable no-undef */
      () => window.resultPromise,
      /* eslint-enable no-undef */
    );
    const actual = result;
    const expect = 42;
    assert({ actual, expect });
  } finally {
    browser.close();
  }
};

await test({ browserLauncher: chromium });
if (process.platform !== "win32") {
  await test({ browserLauncher: firefox });
}
