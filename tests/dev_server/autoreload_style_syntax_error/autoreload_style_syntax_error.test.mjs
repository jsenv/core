/*
 * Test the following:
 * - <style> can hot reload
 * - Introducing a syntax error removes background color
 * - Fixing syntax error restore background color
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
  logLevel: "off",
  serverLogLevel: "off",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
  keepProcessAlive: false,
  port: 0,
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ ignoreHTTPSErrors: true });

try {
  await page.goto(`${devServer.origin}/main.html`);
  const getDocumentBodyBackgroundColor = () => {
    return page.evaluate(
      /* eslint-disable no-undef */
      () => window.getComputedStyle(document.body).backgroundColor,
      /* eslint-enable no-undef */
    );
  };

  {
    const actual = await getDocumentBodyBackgroundColor();
    const expected = `rgb(255, 0, 0)`;
    assert({ actual, expected });
  }

  const pageReloadPromise = page.waitForNavigation();
  htmlFileContent.update(`<!DOCTYPE html>
  <html>
    <head>
      <title>Title</title>
      <meta charset="utf-8" />
      <link rel="icon" href="data:," />
    </head>
  
    <body>
      <style>
        body {
          background: red
          color: blue;
        }
      </style>
    </body>
  </html>`);
  await pageReloadPromise;
  {
    const actual = await getDocumentBodyBackgroundColor();
    const expected = `rgba(0, 0, 0, 0)`;
    assert({ actual, expected });
  }
  htmlFileContent.restore();
  await new Promise((resolve) => {
    setTimeout(resolve, 500);
  });
  {
    const actual = await getDocumentBodyBackgroundColor();
    const expected = `rgb(255, 0, 0)`;
    assert({ actual, expected });
  }
} finally {
  htmlFileContent.restore();
  browser.close();
  devServer.stop(); // required because for some reason the rooms are kept alive
}
