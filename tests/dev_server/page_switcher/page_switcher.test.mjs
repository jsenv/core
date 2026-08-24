/*
 * cmd+K on any page the dev server serves opens the page switcher (see
 * src/plugins/page_switcher/): what it lists, how each page is marked (demo,
 * experiment, plain page) and what filtering leaves — kept as a screenshot and
 * as the markup itself, so a change to either is visible in the diff.
 */

import { startDevServer } from "@jsenv/core";
import { replaceFileStructureSync, writeFileSync } from "@jsenv/filesystem";
import { chromium } from "playwright";

let debug = false;
const sourceDirectoryUrl = import.meta.resolve("./git_ignored/");
const snapshotsDirectoryUrl = import.meta.resolve("./snapshots/");
replaceFileStructureSync({
  from: import.meta.resolve("./fixtures/0_at_start/"),
  to: sourceDirectoryUrl,
});

const devServer = await startDevServer({
  logLevel: "off",
  serverLogLevel: "off",
  sourceDirectoryUrl,
  keepProcessAlive: !debug,
  clientAutoreload: false,
  port: 0,
});
const browser = await chromium.launch({ headless: !debug, devtools: debug });
const page = await browser.newPage({ ignoreHTTPSErrors: true });
await page.setViewportSize({ width: 800, height: 500 });

// The switcher lives in a shadow root (see its client), so its markup is read
// from there rather than from the page's own HTML.
const readSwitcherHtml = () =>
  page.evaluate(() => {
    /* eslint-disable no-undef */
    const host = [...document.body.children].find((element) =>
      element.shadowRoot?.querySelector(".panel"),
    );
    return host ? host.shadowRoot.querySelector(".panel").outerHTML : "";
    /* eslint-enable no-undef */
  });
const takeSnapshots = async (scenario) => {
  writeFileSync(
    new URL(`./${scenario}.png`, snapshotsDirectoryUrl),
    await page.screenshot(),
  );
  writeFileSync(
    new URL(`./${scenario}.html`, snapshotsDirectoryUrl),
    await readSwitcherHtml(),
  );
};
const openSwitcher = async () => {
  await page.keyboard.press("ControlOrMeta+k");
  // The list is fetched the first time it opens.
  await page.waitForFunction(
    () =>
      /* eslint-disable no-undef */
      [...document.body.children].some((element) =>
        element.shadowRoot?.querySelector("li"),
      ),
    /* eslint-enable no-undef */
  );
};

const clickKindToggle = (label) =>
  page.evaluate((kindLabel) => {
    /* eslint-disable no-undef */
    const host = [...document.body.children].find((element) =>
      element.shadowRoot?.querySelector(".panel"),
    );
    const toggle = [...host.shadowRoot.querySelectorAll(".kind_toggle")].find(
      (button) => button.textContent.includes(kindLabel),
    );
    toggle.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    /* eslint-enable no-undef */
  }, label);

try {
  await page.goto(`${devServer.origin}/index.html`);
  await openSwitcher();
  // Demos only to begin with, folded where folding loses nothing.
  await takeSnapshots("0_opened");

  await clickKindToggle("pages");
  await takeSnapshots("1_pages_too");

  // The first row is a directory, and Enter on one folds it instead of
  // navigating.
  await page.keyboard.press("Enter");
  await takeSnapshots("2_folded");
  await page.keyboard.press("Enter");

  await page.keyboard.type("demo");
  await takeSnapshots("3_filtered");

  // Filtering puts the current row on the first match, ArrowDown moves to the
  // next one; Enter on a file goes there, and the switcher is gone with it.
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForURL(/second_demo\.html$/);
  writeFileSync(
    new URL(`./4_after_enter.png`, snapshotsDirectoryUrl),
    await page.screenshot(),
  );
} finally {
  if (!debug) {
    browser.close();
    devServer.stop();
  }
}
