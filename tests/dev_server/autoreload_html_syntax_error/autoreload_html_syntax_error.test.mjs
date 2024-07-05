/*
 * Test the following:
 * - Ensure adding/removing a syntax error in html is gracefully handled
 *   (no waiting forever for importmap to load and js properly executes)
 */

import { chromium } from "playwright";
import { writeFileStructureSync } from "@jsenv/filesystem";
import { assert } from "@jsenv/assert";

import { startDevServer } from "@jsenv/core";

let debug = false;
const sourceDirectoryUrl = new URL("./git_ignored/", import.meta.url);
const atStartDirectoryUrl = new URL("./0_at_start/", import.meta.url);
const withSyntaxErrorDirectoryUrl = new URL(
  "./1_with_html_syntax_error/",
  import.meta.url,
);

writeFileStructureSync(sourceDirectoryUrl, atStartDirectoryUrl);
const devServer = await startDevServer({
  logLevel: "off",
  serverLogLevel: "off",
  sourceDirectoryUrl,
  keepProcessAlive: !debug,
  port: 0,
});

const browser = await chromium.launch({ headless: !debug });
const page = await browser.newPage({ ignoreHTTPSErrors: true });
const readWindowAnswer = async () => {
  const value = await page.evaluate(
    /* eslint-disable no-undef */
    () => window.answer,
    /* eslint-enable no-undef */
  );
  return value;
};
const assertWindowAnswerValue = async (expectValue, scenario) => {
  const actualValue = await readWindowAnswer();
  assert({
    actual: {
      scenario,
      windowAnswer: actualValue,
    },
    expect: {
      scenario,
      windowAnswer: expectValue,
    },
  });
};

try {
  await page.goto(`${devServer.origin}/main.html`);
  await assertWindowAnswerValue(41, "at_start");
  writeFileStructureSync(sourceDirectoryUrl, withSyntaxErrorDirectoryUrl);
  // first time there is no need for page.reload() because autoreload works (there is no syntax error)
  await new Promise((resolve) => setTimeout(resolve, 500));
  await assertWindowAnswerValue(42, "with_html_syntax_error");
  writeFileStructureSync(sourceDirectoryUrl, atStartDirectoryUrl);
  // here we need to reload manually because syntax error prevents injection of autoreload script
  await page.reload();
  await assertWindowAnswerValue(41, "after_restore_at_start");
} finally {
  if (!debug) {
    browser.close();
    devServer.stop();
  }
}
