/*
 * Test server gracefull handle the following story:
 * 1. A js is imported by 2 other js
 * 2. The imported file is renamed
 * 3. One of the file update the import
 * 4. Let the old import for the other file
 */

import { writeFileSync, readFileSync, renameSync } from "node:fs";
import { chromium } from "playwright";
import { assert } from "@jsenv/assert";

import { startDevServer } from "@jsenv/core";

const helperFileUrl = new URL("./client/helper.js", import.meta.url);
const helperRenamedFileUrl = new URL("./client/helper_2.js", import.meta.url);
const jsFileUrl = new URL("./client/a.js", import.meta.url);
const jsFileContent = {
  beforeTest: readFileSync(jsFileUrl),
  update: (content) => writeFileSync(jsFileUrl, content),
  restore: () => writeFileSync(jsFileUrl, jsFileContent.beforeTest),
};
const devServer = await startDevServer({
  logLevel: "warn",
  serverLogLevel: "error",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  clientAutoreload: false,
  supervisor: false,
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
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
    const expected = 42;
    assert({ actual, expected });
  }

  renameSync(helperFileUrl, helperRenamedFileUrl);
  // update the import in a.js but not in b.js
  jsFileContent.update(`import "./helper_2.js"`);

  // now reload and see what happens
  await page.reload();
  const actual = consoleErrors;
  const expected = [
    "Failed to load resource: the server responded with a status of 404 (no entry on filesystem)",
  ];
  assert({ actual, expected });
} finally {
  jsFileContent.restore();
  renameSync(helperRenamedFileUrl, helperFileUrl);
  browser.close();
}
