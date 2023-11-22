import { chromium } from "playwright";
import { takeFileSnapshot } from "@jsenv/snapshot";
import { assert } from "@jsenv/assert";

import { startDevServer } from "@jsenv/core";
import { launchBrowserPage } from "@jsenv/core/tests/launch_browser_page.js";

import { jsenvPluginAsJsClassic } from "@jsenv/plugin-as-js-classic";

const debug = false; // true to have browser UI + keep it open after test
const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  clientAutoreload: false,
  supervisor: false,
  plugins: [jsenvPluginAsJsClassic()],
  outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
  ribbon: false,
  sourcemaps: "none",
  port: 0,
});
const browser = await chromium.launch({ headless: !debug });
try {
  const page = await launchBrowserPage(browser);
  await page.goto(`${devServer.origin}/main.html`);

  {
    const actual = await page.evaluate(
      /* eslint-disable no-undef */
      () => window.answer,
      /* eslint-enable no-undef */
    );
    const expected = 42;
    assert({ actual, expected });
  }
} finally {
  if (!debug) {
    browser.close();
  }
}

if (process.platform !== "win32") {
  const runtimeId = Array.from(devServer.kitchenCache.keys())[0];
  takeFileSnapshot(
    new URL(`./.jsenv/${runtimeId}/main.html`, import.meta.url),
    new URL("./snapshots/dev/main.html", import.meta.url),
  );
}
