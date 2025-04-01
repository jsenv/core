/*
 * Test the following:
 * - A non deterministic plugin error while cooking inline style does not prevent
 * - browser from displaying the underlying html + css in that <style>
 */

import { assert } from "@jsenv/assert";
import { startDevServer } from "@jsenv/core";
import { firefox } from "playwright";

const devServer = await startDevServer({
  logLevel: "off",
  serverLogLevel: "off",
  sourceDirectoryUrl: import.meta.resolve("./client/"),
  outDirectoryUrl: import.meta.resolve("./.jsenv/"),
  keepProcessAlive: false,
  port: 0,
  clientAutoreload: false,
  ribbon: false,
});

const browser = await firefox.launch({ headless: true });
const page = await browser.newPage({ ignoreHTTPSErrors: true });
const getResult = () => {
  return page.evaluate(
    /* eslint-disable no-undef */
    () => window.resultPromise,
    /* eslint-enable no-undef */
  );
};

try {
  await page.goto(`${devServer.origin}/main.html`);
  const atStart = await getResult();
  assert({
    actual: {
      atStart,
    },
    expect: {
      atStart: 42,
    },
  });
} finally {
  browser.close();
  devServer.stop(); // required because for some reason the rooms are kept alive
}
