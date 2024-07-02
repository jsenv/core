/*
 * Ensure file not watched are still properly invalidated
 * when they are modified
 * 1. load a first time
 * 2. 304 on reload
 * 3. update the file
 * 4. 200 on reload
 */

import { writeFileSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { assert } from "@jsenv/assert";

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
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  clientAutoreload: false,
  supervisor: false,
  port: 0,
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await launchBrowserPage(browser);
  const responses = [];
  page.on("response", (response) => {
    responses.push(response);
  });
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
    const actual = await getResult();
    const expect = 42;
    assert({ actual, expect });
  }

  // now reload, expect 304
  {
    responses.length = 0;
    await page.reload();
    const responseForJsFile = responses.find(
      (response) => response.url() === `${devServer.origin}/main.js`,
    );
    const jsFileResponseStatus = responseForJsFile.status();
    const answer = await getResult();
    const actual = {
      jsFileResponseStatus,
      answer,
    };
    const expect = {
      jsFileResponseStatus: 304,
      answer: 42,
    };
    assert({ actual, expect });
  }

  // change original file content
  // then reload, expect 200 + correct content served
  {
    responses.length = 0;
    jsFileContent.update(`window.resolveResultPromise(43)`);
    await new Promise((resolve) => setTimeout(resolve, 500));
    await page.reload();
    const responseForJsFile = responses.find(
      (response) => response.url() === `${devServer.origin}/main.js`,
    );
    const jsFileResponseStatus = responseForJsFile.status();
    const answer = await getResult();
    const actual = {
      jsFileResponseStatus,
      answer,
    };
    const expect = {
      jsFileResponseStatus: 200,
      answer: 43,
    };
    assert({ actual, expect });
  }
} finally {
  jsFileContent.restore();
  browser.close();
}
