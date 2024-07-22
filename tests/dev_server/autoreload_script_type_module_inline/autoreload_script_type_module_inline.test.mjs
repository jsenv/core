import { assert } from "@jsenv/assert";
import { readFileSync, writeFileSync } from "@jsenv/filesystem";
import { chromium } from "playwright";

import { startDevServer } from "@jsenv/core";
import { launchBrowserPage } from "@jsenv/core/tests/launch_browser_page.js";

let debug = false;
writeFileSync(
  new URL("./git_ignored/main.html", import.meta.url),
  readFileSync(new URL("./fixtures/0_at_start.html", import.meta.url)),
);
const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./git_ignored/", import.meta.url),
  keepProcessAlive: false,
  clientAutoreload: {
    cooldownBetweenFileEvents: 250,
  },
  port: 0,
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
    const expect = 42;
    assert({ actual, expect });
  }
  const navigationPromise = page.waitForNavigation();
  writeFileSync(
    new URL("./git_ignored/main.html", import.meta.url),
    readFileSync(new URL("./fixtures/1_after_update.html", import.meta.url)),
  );
  await navigationPromise; // full reload
  {
    const actual = await getResult();
    const expect = 43;
    assert({ actual, expect });
  }
} finally {
  if (!debug) {
    browser.close();
  }
}
