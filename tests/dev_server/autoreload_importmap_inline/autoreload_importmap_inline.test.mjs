/*
 * Test the following:
 * - importmap resolution applies correctly when inline
 * - updating inline importmap trigger autoreload + correctly update resolution
 */

import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { assert } from "@jsenv/assert";

import { startDevServer } from "@jsenv/core";

const htmlFileUrl = new URL("./client/main.html", import.meta.url);
const htmlFileContent = {
  beforeTest: readFileSync(htmlFileUrl),
  update: (content) => writeFileSync(htmlFileUrl, content),
  restore: () => writeFileSync(htmlFileUrl, htmlFileContent.beforeTest),
};
const devServer = await startDevServer({
  logLevel: "warn",
  serverLogLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
  keepProcessAlive: false,
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ ignoreHTTPSErrors: true });

try {
  await page.goto(`${devServer.origin}/main.html`);
  const getWindowAnswer = () => {
    return page.evaluate(
      /* eslint-disable no-undef */
      () => window.answer,
      /* eslint-enable no-undef */
    );
  };

  {
    const actual = await getWindowAnswer();
    const expected = 42;
    assert({ actual, expected });
  }

  const pageReloadPromise = page.waitForNavigation();
  htmlFileContent.update(`<!doctype html>
  <html>
    <head>
      <title>Title</title>
      <meta charset="utf-8" />
      <link rel="icon" href="data:," />
    </head>
  
    <body>
      <script type="importmap">
        {
          "imports": {
            "a": "./b.js"
          }
        }
      </script>
      <script type="module">
        // eslint-disable-next-line import/no-unresolved
        import { answer } from "a";
  
        window.answer = answer;
        console.log(answer);
      </script>
    </body>
  </html>`);
  await pageReloadPromise;
  {
    const actual = await getWindowAnswer();
    const expected = "b";
    assert({ actual, expected });
  }
  htmlFileContent.restore();
  await new Promise((resolve) => setTimeout(resolve, 500));
  {
    const actual = await getWindowAnswer();
    const expected = 42;
    assert({ actual, expected });
  }
} finally {
  htmlFileContent.restore();
  browser.close();
  devServer.stop(); // required because for some reason the rooms are kept alive
}
