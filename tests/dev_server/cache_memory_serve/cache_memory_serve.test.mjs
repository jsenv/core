/*
 * A browser with its cache disabled (devtools open) sends no if-none-match,
 * so it can never receive a 304 — but the dev server must not re-cook a file
 * that did not change for each of these requests: it serves the graph's
 * in-memory content, and says so with a server-timing "memory" entry.
 * What matters as much as the speed is the invalidation: memory must be
 * served ONLY while the file is unchanged.
 * 1. load a first time (cooked)
 * 2. reload with cache disabled: 200 from memory, same content
 * 3. update the file, reload: 200 freshly cooked, NEW content (never stale)
 * 4. reload again: back to memory, with the new content
 */

import { assert } from "@jsenv/assert";
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

import { startDevServer } from "@jsenv/core";
import { launchBrowserPage } from "@jsenv/core/tests/launch_browser_page.js";

const jsFileUrl = new URL("./client/main.js", import.meta.url);
const jsFileContent = {
  beforeTest: readFileSync(jsFileUrl),
  update: (content) => writeFileSync(jsFileUrl, content),
  restore: () => writeFileSync(jsFileUrl, jsFileContent.beforeTest),
};
const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: import.meta.resolve("./client/"),
  keepProcessAlive: false,
  clientAutoreload: false,
  supervisor: false,
  // every timing entry, whatever it took: the assertions below read the header
  serverTiming: { minDuration: 0 },
  port: 0,
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await launchBrowserPage(browser);
  // the devtools "Disable cache" behavior: no browser cache, so every request
  // reaches the server without if-none-match
  const cdpSession = await page.context().newCDPSession(page);
  await cdpSession.send("Network.enable");
  await cdpSession.send("Network.setCacheDisabled", { cacheDisabled: true });

  const responses = [];
  page.on("response", (response) => {
    responses.push(response);
  });
  const getResult = async () => {
    const result = await page.evaluate(
      /* eslint-disable no-undef */
      () => window.resultPromise,
      /* eslint-enable no-undef */
    );
    return result;
  };
  const jsFileResponseInfo = async () => {
    const response = responses.find(
      (candidate) => candidate.url() === `${devServer.origin}/main.js`,
    );
    const serverTiming = (await response.allHeaders())["server-timing"] || "";
    return {
      status: response.status(),
      servedFromMemory: serverTiming.includes(
        `desc="served from memory cache"`,
      ),
    };
  };

  await page.goto(`${devServer.origin}/main.html`);

  // 1. first load: cooked, not from memory
  {
    const actual = {
      ...(await jsFileResponseInfo()),
      answer: await getResult(),
    };
    const expect = {
      status: 200,
      servedFromMemory: false,
      answer: 42,
    };
    assert({ actual, expect });
  }

  // 2. reload: nothing changed, served from memory, same content
  {
    responses.length = 0;
    await page.reload();
    const actual = {
      ...(await jsFileResponseInfo()),
      answer: await getResult(),
    };
    const expect = {
      status: 200,
      servedFromMemory: true,
      answer: 42,
    };
    assert({ actual, expect });
  }

  // 3. file updated: re-cooked, the NEW content is served
  {
    responses.length = 0;
    jsFileContent.update(`window.resolveResultPromise(43);`);
    await new Promise((resolve) => setTimeout(resolve, 500));
    await page.reload();
    const actual = {
      ...(await jsFileResponseInfo()),
      answer: await getResult(),
    };
    const expect = {
      status: 200,
      servedFromMemory: false,
      answer: 43,
    };
    assert({ actual, expect });
  }

  // 4. reload once more: back to memory, with the updated content
  {
    responses.length = 0;
    await page.reload();
    const actual = {
      ...(await jsFileResponseInfo()),
      answer: await getResult(),
    };
    const expect = {
      status: 200,
      servedFromMemory: true,
      answer: 43,
    };
    assert({ actual, expect });
  }
} finally {
  jsFileContent.restore();
  browser.close();
}
