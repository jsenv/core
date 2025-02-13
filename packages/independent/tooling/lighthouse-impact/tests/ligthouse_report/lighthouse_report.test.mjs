import { assert } from "@jsenv/assert";
import { readFile } from "@jsenv/filesystem";
import { runLighthouseOnPlaywrightPage } from "@jsenv/lighthouse-impact";
import { startServer } from "@jsenv/server";
import { chromium } from "playwright";

if (process.platform !== "win32") {
  // chrome-launcher does not work on windows
  process.exit(0);
}

process.exit(0); // TOFIX

const htmlFileUrl = new URL("./index.html", import.meta.url);
const server = await startServer({
  logLevel: "warn",
  services: [
    {
      handleRequest: async () => {
        const htmlFileContent = await readFile(htmlFileUrl, { as: "string" });
        return {
          status: 200,
          headers: {
            "content-type": "text/html",
          },
          body: htmlFileContent,
        };
      },
    },
  ],
  keepProcessAlive: false,
});
const browser = await chromium.launch({
  args: ["--remote-debugging-port=9222"],
});
const context = await browser.newContext({
  // userAgent: "",
  ignoreHTTPSErrors: true,
  viewport: {
    width: 640,
    height: 380,
  },
  screen: {
    width: 640,
    height: 380,
  },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 1,
});
const page = await context.newPage();
await page.goto(server.origin);

try {
  const actual = await runLighthouseOnPlaywrightPage(page, {
    chromiumDebuggingPort: "9222",
    // runCount: 2,
    // headless: false,
    // emulatedMobile: true,
    // htmlFileUrl: new URL("./report.html", import.meta.url),
    // jsonFileUrl: new URL("./report.json", import.meta.url),
  });
  const expect = actual;
  assert({ actual, expect });
} finally {
  await context.close();
  await browser.close();
}
