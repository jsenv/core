/*
 * Ensures standard script execution order is preserved by jsenv supervisor
 */

import { assert } from "@jsenv/assert";
import { chromium, firefox, webkit } from "playwright";

import { startDevServer } from "@jsenv/core";
import { launchBrowserPage } from "@jsenv/core/tests/launch_browser_page.js";

const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
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
    // this should be the order found in each browser
    // However on webkit it will be different because of a bug (https://twitter.com/damienmaillard/status/1554752482273787906)
    const correctOrder = [
      "before_js_classic_inline",
      "js_classic_inline",
      "before_js_classic_src",
      "js_classic_a",
      "js_classic_b",
      "js_module_inline",
      "js_module_a",
      "js_module_b",
      "js_module_a_after_top_level_await",
    ];

    if (browserLauncher === chromium) {
      const actual = result;
      const expect = correctOrder;
      assert({
        actual,
        expect,
        details: {
          browser: `chromium`,
        },
      });
    }
    if (browserLauncher === firefox) {
      const actual = result;
      const expect = correctOrder;
      assert({
        actual,
        expect,
        details: {
          browser: `firefox`,
        },
      });
    }
    if (browserLauncher === webkit) {
      // window "load" event is not deterministic on webkit due to
      // the bug mentioned previously so order is different
      const actual = result;
      const expect = [
        "before_js_classic_inline",
        "js_classic_inline",
        "before_js_classic_src",
        "js_classic_a",
        "js_classic_b",
        "js_module_inline",
        "js_module_a",
        "js_module_a_after_top_level_await",
        "js_module_b",
      ];
      assert({
        actual,
        expect,
        details: {
          browser: `webkit`,
        },
      });
    }
  } finally {
    browser.close();
  }
};

await test({ browserLauncher: chromium });
// firefox super slow sometimes on windows
if (process.platform !== "win32") {
  // await test({ browserLauncher: firefox })
}
// in practice no one uses webkit + windows
// moreover this test is flaky
if (process.platform !== "win32") {
  await test({ browserLauncher: webkit });
}
