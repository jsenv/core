import { assert } from "@jsenv/assert";
import { createRequire } from "node:smodule";

import { fetchFileSystem, startServer } from "@jsenv/server";

const require = createRequire(import.meta.url);
const testDirectoryUrl = new URL("./", import.meta.url).href;

// eslint-disable-next-line import-x/no-unresolved
const { chromium } = require("playwright-chromium");

const server = await startServer({
  logLevel: "warn",
  keepProcessAlive: false,
  http2: true,
  port: 3456,
  requestToResponse: (request) => {
    return fetchFileSystem(
      new URL(request.resource.slice(1), import.meta.url),
      {
        headers: request.headers,
        rootDirectoryUrl: testDirectoryUrl,
      },
    );
  },
});
const browser = await chromium.launch({
  // headless: false,
});
const page = await browser.newPage({
  ignoreHTTPSErrors: true,
});
await page.goto(`${server.origin}/index.html`);
const actual = await page.evaluate(`window.ask()`);
const expect = 42;
assert({ actual, expect });
browser.close();
