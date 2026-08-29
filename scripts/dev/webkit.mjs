/*
 * Opens a page in WebKit (Safari's engine) through Playwright, to look at a
 * demo the way Safari draws it. The window stays open until it is closed.
 *
 * node ./scripts/dev/webkit.mjs
 * node ./scripts/dev/webkit.mjs packages/frontend/navi/src/control/demos/picker/0_picker_demo.html
 * node ./scripts/dev/webkit.mjs http://127.0.0.1:3456/packages/...
 *
 * A repo-relative path is served by the dev server (npm run dev, port 3456),
 * which must already be running.
 */

import { webkit } from "playwright";

const DEV_SERVER_ORIGIN = "http://127.0.0.1:3456";

const [, , target = ""] = process.argv;
const url = target.includes("://")
  ? target
  : `${DEV_SERVER_ORIGIN}/${target.replace(/^\.?\//, "")}`;

if (url.startsWith(DEV_SERVER_ORIGIN)) {
  const devServerIsUp = await fetch(DEV_SERVER_ORIGIN, {
    signal: AbortSignal.timeout(2000),
  }).then(
    () => true,
    () => false,
  );
  if (!devServerIsUp) {
    console.error(
      `dev server not reachable at ${DEV_SERVER_ORIGIN} — start it with "npm run dev"`,
    );
    process.exit(1);
  }
}

const browser = await webkit.launch({ headless: false });
const context = await browser.newContext({
  viewport: null,
  locale: "fr-FR",
});
const page = await context.newPage();
page.on("pageerror", (error) => {
  console.error("[page error]", error.message);
});
page.on("console", (message) => {
  if (message.type() === "error") {
    console.error("[console error]", message.text());
  }
});

console.log(`opening ${url} in WebKit`);
await page.goto(url);

page.on("close", async () => {
  await browser.close();
  process.exit(0);
});
