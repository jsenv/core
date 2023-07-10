import { chromium } from "playwright";
import { assert } from "@jsenv/assert";

import { startDevServer } from "@jsenv/core";
import { launchBrowserPage } from "@jsenv/core/tests/launch_browser_page.js";

let debug = false;
let pruneCalls = [];
const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  clientAutoreload: {
    cooldownBetweenFileEvents: 250,
    clientFilePruneCallbackList: [
      (call) => {
        pruneCalls.push(call);
      },
    ],
  },
  sourcemaps: "off",
});
const browser = await chromium.launch({ headless: !debug });
try {
  const page = await launchBrowserPage(browser);
  await page.goto(`${devServer.origin}/main.html`);
  const getResult = async () => {
    const result = await page.evaluate(
      /* eslint-disable no-undef */
      () => window.resultPromise,
      /* eslint-enable no-undef */
    );
    return result;
  };

  {
    const actual = {
      result: await getResult(),
      pruneCalls,
    };
    const expected = {
      result: 42,
      pruneCalls: [],
    };
    assert({ actual, expected });
  }
  await page.reload();
  {
    const actual = {
      result: await getResult(),
      pruneCalls,
    };
    const expected = {
      result: 42,
      pruneCalls: [],
    };
    assert({ actual, expected });
  }
} finally {
  if (!debug) {
    browser.close();
  }
}
