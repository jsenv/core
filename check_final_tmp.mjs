import { startDevServer } from "@jsenv/core";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";
import { chromium } from "playwright";

const devServer = await startDevServer({
  logLevel: "off", serverLogLevel: "off",
  sourceDirectoryUrl: new URL("file:///Users/dmail/Documents/dev/jsenv/core/"),
  keepProcessAlive: false, port: 0, plugins: [jsenvPluginPreact()], ribbon: false,
});
const browser = await chromium.launch({ headless: true });

const openDialogDemo = async (opts, name) => {
  const context = await browser.newContext(opts);
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log(name, "PAGEERROR:", e.message));
  await page.goto(`${devServer.origin}/packages/frontend/navi/src/popup/demos/dialog_demo.html`);
  await page.waitForTimeout(1200);
  await page.locator("#adaptive .demo-row button").first().click();
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    const d = document.querySelector("#adaptive_dialog");
    const b = d.getBoundingClientRect();
    return { x: Math.round(b.x), w: Math.round(b.width), bottomGap: Math.round(innerHeight - b.bottom),
      expandX: d.hasAttribute("data-expand-x"), vw: innerWidth };
  });
  console.log(name, JSON.stringify(r));
  await context.close();
};
await openDialogDemo({ viewport: { width: 1100, height: 800 } }, "mouse");
await openDialogDemo({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true }, "touch");

const context = await browser.newContext({ viewport: { width: 500, height: 800 }, hasTouch: true, isMobile: true });
const page = await context.newPage();
page.on("pageerror", (e) => console.log("picker PAGEERROR:", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("picker CONSOLE:", m.text()); });
await page.goto(`${devServer.origin}/packages/frontend/navi/src/control/demos/picker/1_select_demo.html`);
await page.waitForTimeout(1500);
console.log("picker demo loaded, no error above = ok");
await browser.close();
devServer.stop();
