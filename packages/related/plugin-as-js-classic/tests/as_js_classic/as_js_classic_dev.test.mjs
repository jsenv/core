import { assert } from "@jsenv/assert";
import { startDevServer } from "@jsenv/core";
import { launchBrowserPage } from "@jsenv/core/tests/launch_browser_page.js";
import { replaceFileStructureSync } from "@jsenv/filesystem";
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

import { jsenvPluginAsJsClassic } from "@jsenv/plugin-as-js-classic";

const debug = false; // true to have browser UI + keep it open after test to inspect things
const sourceDirectoryUrl = new URL("./git_ignored/", import.meta.url);
replaceFileStructureSync({
  from: new URL(`./fixtures/`, import.meta.url),
  to: sourceDirectoryUrl,
});
const devServer = await startDevServer({
  logLevel: "warn",
  plugins: [jsenvPluginAsJsClassic()],
  sourceDirectoryUrl,
  outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
  keepProcessAlive: false,
  clientAutoreload: false,
  supervisor: false,
  ribbon: false,
  port: 0,
});
const browser = await chromium.launch({ headless: !debug });
const jsFileUrl = new URL("./dep.js", sourceDirectoryUrl);
const jsFileContent = {
  beforeTest: readFileSync(jsFileUrl),
  update: (content) => writeFileSync(jsFileUrl, content),
  restore: () => writeFileSync(jsFileUrl, jsFileContent.beforeTest),
};
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
      () => window.answer,
      /* eslint-enable no-undef */
    );
    return result;
  };

  {
    const actual = await getResult();
    const expect = 42;
    assert({ actual, expect });
  }

  // reloading page = 304
  {
    responses.length = 0;
    await page.reload();
    const responseForJsFile = responses.find((response) => {
      const urlCandidate = response.url();
      return urlCandidate === `${devServer.origin}/main.js?as_js_classic`;
    });
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

  {
    jsFileContent.update(`export const answer = 43`);
    await new Promise((resolve) => setTimeout(resolve, 150));
    await page.reload();
    const actual = await getResult();
    const expect = 43;
    assert({ actual, expect });
  }
} finally {
  jsFileContent.restore();
  if (!debug) {
    browser.close();
  }
}
