import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { assert } from "@jsenv/assert";

import { startDevServer } from "@jsenv/core";
import { launchBrowserPage } from "@jsenv/core/tests/launch_browser_page.js";

let debug = false;
const htmlFileUrl = new URL("./client/main.html", import.meta.url);
const htmlFileContent = {
  beforeTest: readFileSync(htmlFileUrl),
  update: (content) => writeFileSync(htmlFileUrl, content),
  restore: () => writeFileSync(htmlFileUrl, htmlFileContent.beforeTest),
};

const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  clientAutoreload: {
    cooldownBetweenFileEvents: 250,
  },
});
const browser = await chromium.launch({ headless: !debug });
try {
  const page = await launchBrowserPage(browser);
  await page.goto(`${devServer.origin}/main.html?foo`);
  const getResult = async () => {
    const result = await page.evaluate(
      /* eslint-disable no-undef */
      () => window.resultPromise,
      /* eslint-enable no-undef */
    );
    return result;
  };

  {
    const actual = await getResult();
    const expected = 42;
    assert({ actual, expected });
  }
  const navigationPromise = page.waitForNavigation();
  htmlFileContent.update(
    String(htmlFileContent.beforeTest).replace(
      "window.resolveResultPromise(42);",
      "window.resolveResultPromise(43);",
    ),
  );
  await navigationPromise; // full reload
  {
    const actual = await getResult();
    const expected = 43;
    assert({ actual, expected });
  }
} finally {
  htmlFileContent.restore();
  if (!debug) {
    browser.close();
  }
}
