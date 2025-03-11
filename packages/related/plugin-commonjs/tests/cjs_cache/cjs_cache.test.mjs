import { assert } from "@jsenv/assert";
import { startDevServer } from "@jsenv/core";
import { launchBrowserPage } from "@jsenv/core/tests/launch_browser_page.js";
import { ensureEmptyDirectory } from "@jsenv/filesystem";
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

import { jsenvPluginCommonJs } from "@jsenv/plugin-commonjs";

const debug = false; // true to have browser UI + keep it open after test
await ensureEmptyDirectory(new URL("./.jsenv/", import.meta.url));
const cjsFileUrl = new URL("./client/dep.cjs", import.meta.url);
const cjsFileContent = {
  beforeTest: readFileSync(cjsFileUrl),
  update: (content) => writeFileSync(cjsFileUrl, content),
  restore: () => writeFileSync(cjsFileUrl, cjsFileContent.beforeTest),
};
const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  plugins: [
    jsenvPluginCommonJs({
      include: { "./file.cjs": true },
    }),
  ],
  clientAutoreload: false,
  supervisor: false,
  port: 0,
});
const browser = await chromium.launch({
  headless: !debug,
});
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
    const actual = await getResult();
    const expect = 42;
    assert({ actual, expect });
  }

  // now update the package content + version and see if reloading the page updates the result
  {
    cjsFileContent.update(`module.exports = 43`);
    await page.reload();
    const actual = await getResult();
    const expect = 43;
    assert({ actual, expect });
  }
} finally {
  if (!debug) {
    browser.close();
  }
  cjsFileContent.restore();
}
