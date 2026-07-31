/*
 * What happens when "npm install" brings a new version of a dependency
 * while the dev server is running: the package directory is replaced on the
 * filesystem (node_modules is not watched by the dev server), then the browser
 * is reloaded.
 *
 * - "main.html" imports the package from an external js module -> the new version is used
 * - "inline.html" imports the package from an inline js module -> the old version is still used
 *   (the 304 check for an inline script is done against its parent HTML etag,
 *   and the HTML content did not change)
 */

import { assert } from "@jsenv/assert";
import {
  ensureEmptyDirectory,
  writeFileStructureSync,
} from "@jsenv/filesystem";
import { chromium } from "playwright";

import { startDevServer } from "@jsenv/core";
import { launchBrowserPage } from "@jsenv/core/tests/launch_browser_page.js";

const debug = false; // true to have browser UI + keep it open after test
const nodeModulesDirectoryUrl = new URL(
  "./client/node_modules/",
  import.meta.url,
);
const installFoo = ({ version, answer }) => {
  writeFileStructureSync(nodeModulesDirectoryUrl, {
    "foo/package.json": JSON.stringify(
      { name: "foo", private: true, version },
      null,
      "  ",
    ),
    "foo/index.js": `export { answer } from "./answer.js";`,
    "foo/answer.js": `export const answer = ${answer};`,
  });
};

await ensureEmptyDirectory(new URL("./.jsenv/", import.meta.url));
installFoo({ version: "1.0.0", answer: 42 });
const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: import.meta.resolve("./client/src/"),
  keepProcessAlive: false,
  outDirectoryUrl: import.meta.resolve("./.jsenv/"),
  port: 0,
});
const browser = await chromium.launch({ headless: !debug });
try {
  const page = await launchBrowserPage(browser);
  const getResult = () => {
    return page.evaluate(
      /* eslint-disable no-undef */
      () => window.resultPromise,
      /* eslint-enable no-undef */
    );
  };

  external_js_module: {
    await page.goto(`${devServer.origin}/main.html`);
    {
      const actual = await getResult();
      const expect = 42;
      assert({ actual, expect });
    }
    installFoo({ version: "1.0.1", answer: 43 });
    await page.reload();
    {
      const actual = await getResult();
      const expect = 43;
      assert({ actual, expect });
    }
  }

  installFoo({ version: "1.0.2", answer: 44 });

  inline_js_module: {
    await page.goto(`${devServer.origin}/inline.html`);
    {
      const actual = await getResult();
      const expect = 44;
      assert({ actual, expect });
    }
    installFoo({ version: "1.0.3", answer: 45 });
    await page.reload();
    {
      const actual = await getResult();
      const expect = 45;
      assert({ actual, expect });
    }
  }
} finally {
  installFoo({ version: "1.0.0", answer: 42 });
  if (!debug) {
    browser.close();
  }
}
