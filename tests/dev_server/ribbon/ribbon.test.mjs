import { startDevServer } from "@jsenv/core";
import { writeFileSync } from "@jsenv/filesystem";
import { assert } from "@jsenv/assert";
import { chromium } from "playwright";

let debug = false;
const sourceDirectoryUrl = import.meta.resolve("./client/");
const snapshotsDirectoryUrl = import.meta.resolve("./snapshots/");

const browser = await chromium.launch({ headless: !debug, devtools: debug });
const page = await browser.newPage({ ignoreHTTPSErrors: true });
await page.setViewportSize({ width: 800, height: 500 });

const takeScreenshot = async (scenario) => {
  const screenshotBuffer = await page.screenshot();
  writeFileSync(
    new URL(`./${scenario}.png`, snapshotsDirectoryUrl),
    screenshotBuffer,
  );
};
const openPageWithRibbon = async (ribbon) => {
  const devServer = await startDevServer({
    logLevel: "off",
    serverLogLevel: "off",
    sourceDirectoryUrl,
    keepProcessAlive: false,
    clientAutoreload: false,
    port: 0,
    ribbon,
  });
  await page.goto(`${devServer.origin}/main.html`);
  await page.locator("#jsenv_ribbon_text").waitFor();
  return devServer;
};
// the point where the diagonal band crosses the top right corner square,
// and a point inside that same square but away from the band
const bandPoint = { x: 776, y: 24 };
const cornerPointOffBand = { x: 715, y: 90 };
const elementNameAt = async ({ x, y }) => {
  return page.evaluate(
    /* eslint-disable no-undef */
    ([x, y]) => document.elementFromPoint(x, y).nodeName,
    /* eslint-enable no-undef */
    [x, y],
  );
};

try {
  const scenarios = {
    "0_dev_default": true,
    "1_preview_link": {
      text: "preview",
      color: "#7c3aed",
      href: "https://github.com/org/repo/pull/42",
    },
    "2_top_left": {
      text: "preview",
      color: "#7c3aed",
      position: "top-left",
    },
    "3_bottom_right": {
      text: "preview",
      color: "#7c3aed",
      position: "bottom-right",
    },
    "4_bottom_left": {
      text: "preview",
      color: "#7c3aed",
      position: "bottom-left",
    },
    "5_band_top": {
      text: "preview of pull request #42",
      color: "#7c3aed",
      href: "https://github.com/org/repo/pull/42",
      position: "top",
    },
    "6_band_bottom": {
      text: "staging",
      color: "#0f766e",
      position: "bottom",
    },
  };
  for (const scenario of Object.keys(scenarios)) {
    const devServer = await openPageWithRibbon(scenarios[scenario]);
    await takeScreenshot(scenario);
    devServer.stop();
  }

  // a ribbon with an href is hovered/focused as a whole: only the visible band
  // captures the pointer, the rest of the corner square keeps letting through
  {
    const devServer = await openPageWithRibbon({
      text: "preview",
      color: "#7c3aed",
      href: "https://github.com/org/repo/pull/42",
    });
    await page.locator("#jsenv_ribbon_text").hover();
    await takeScreenshot("7_link_hovered");
    const actual = {
      onBand: await elementNameAt(bandPoint),
      offBand: await elementNameAt(cornerPointOffBand),
    };
    const expect = {
      onBand: "JSENV-RIBBON",
      offBand: "MAIN",
    };
    assert({ actual, expect });
    devServer.stop();
  }

  // without href nothing in the corner is interactive: the app interface
  // underneath still receives the clicks
  {
    const devServer = await openPageWithRibbon(true);
    await page.locator("#notification_button").click();
    await takeScreenshot("8_click_through_to_app");
    const actual = await page.locator("#notification_status").textContent();
    const expect = "notifications opened";
    assert({ actual, expect });
    devServer.stop();
  }
} finally {
  if (!debug) {
    browser.close();
  }
}
