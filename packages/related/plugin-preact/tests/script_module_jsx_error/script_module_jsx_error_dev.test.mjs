import { chromium } from "playwright";
import { assert } from "@jsenv/assert";
import { startDevServer } from "@jsenv/core";

const devServer = await startDevServer({
  logLevel: "off",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  port: 0,
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  let resolveFirstErrorPromise;
  const firstErrorPromise = new Promise((resolve) => {
    resolveFirstErrorPromise = resolve;
  });
  page.on("pageerror", (error) => {
    resolveFirstErrorPromise(error);
  });
  await page.goto(`${devServer.origin}/main.noeslint.html`);
  const actual = await firstErrorPromise;
  const expect = new Error(`Unexpected token '<'`);
  expect.name = "SyntaxError";
  assert({ actual, expect });
} finally {
  browser.close();
}
