import { chromium, firefox, webkit } from "playwright";
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
      () => window.__supervisor__.getDocumentExecutionResult(),
      /* eslint-enable no-undef */
    );
    const moduleExecutionResult =
      result.executionResults["/main.html@L10C5-L12C14.js"];
    const actual = moduleExecutionResult.timings.end;
    assert({
      actual,
      expected: assert.between(3_000, 8_000),
      details: {
        browser: `${browserLauncher.name()}`,
      },
    });
  } finally {
    browser.close();
  }
};

// firefox super slow sometimes on windows/mac
if (!process.env.CI) {
  await test({ browserLauncher: firefox });
  await test({ browserLauncher: webkit });
}
await test({ browserLauncher: chromium });
