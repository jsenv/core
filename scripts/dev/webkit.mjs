/*
 * Opens a URL in WebKit (Safari's engine) through Playwright, to look at a page
 * the way Safari draws it. The window stays open until it is closed.
 *
 * node ./scripts/dev/webkit.mjs <url>
 * node ./scripts/dev/webkit.mjs <url> --iphone       # iPhone 15 emulation
 * node ./scripts/dev/webkit.mjs <url> --device="iPad Pro 11"
 *
 * A device emulation sets the viewport, the device pixel ratio, touch
 * (pointer: coarse), and an iOS user agent — it is what puts navi in its
 * phone layout (bottom sheets, touch targets). The engine stays the WebKit
 * Playwright ships, which is more recent than any iPhone's.
 */

import { devices, webkit } from "playwright";

const DEFAULT_URL = "http://127.0.0.1:3456/";
const DEFAULT_DEVICE = "iPhone 15";

let url = DEFAULT_URL;
let deviceName;
for (const arg of process.argv.slice(2)) {
  if (arg === "--iphone") {
    deviceName = DEFAULT_DEVICE;
  } else if (arg.startsWith("--device=")) {
    deviceName = arg.slice("--device=".length);
  } else {
    url = arg;
  }
}
if (deviceName && !devices[deviceName]) {
  console.error(
    `unknown device "${deviceName}" — pick one of: ${Object.keys(devices)
      .filter((name) => !name.endsWith("landscape"))
      .join(", ")}`,
  );
  process.exit(1);
}

const browser = await webkit.launch({ headless: false });
const context = await browser.newContext({
  ...(deviceName ? devices[deviceName] : { viewport: null }),
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

console.log(`opening ${url} in WebKit${deviceName ? ` as ${deviceName}` : ""}`);
await page.goto(url);

page.on("close", async () => {
  await browser.close();
  process.exit(0);
});
