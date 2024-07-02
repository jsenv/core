import { writeFileSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { assert } from "@jsenv/assert";

import { startDevServer } from "@jsenv/core";
import { launchBrowserPage } from "@jsenv/core/tests/launch_browser_page.js";

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
  clientAutoreload: false,
  supervisor: true,
  port: 0,
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await launchBrowserPage(browser);
  const responses = [];
  page.on("response", (response) => {
    responses.push(response);
  });
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

  // now reload, expect 304
  {
    responses.length = 0;
    await page.reload();
    const responseForInlineJsFile = responses.find(
      (response) =>
        response.url() === `${devServer.origin}/main.html@L10C5-L14C14.js`,
    );
    const inlineJsResponseStatus = responseForInlineJsFile.status();
    const answer = await getResult();
    const actual = {
      inlineJsResponseStatus,
      answer,
    };
    const expect = {
      inlineJsResponseStatus: 304,
      answer: 42,
    };
    assert({ actual, expect });
  }

  // change original file content
  // then reload, expect 200 + correct content served
  {
    responses.length = 0;
    htmlFileContent.update(
      String(htmlFileContent.beforeTest).replace(
        "window.resolveResultPromise(42);",
        "window.resolveResultPromise(43);",
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    await page.reload();
    const responseForInlineJsFile = responses.find(
      (response) =>
        response.url() === `${devServer.origin}/main.html@L10C5-L14C14.js`,
    );
    const inlineJsResponseStatus = responseForInlineJsFile.status();
    const answer = await getResult();
    const actual = {
      inlineJsResponseStatus,
      answer,
    };
    const expect = {
      inlineJsResponseStatus: 200,
      answer: 43,
    };
    assert({ actual, expect });
  }
} finally {
  htmlFileContent.restore();
  browser.close();
}
