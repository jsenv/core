/*
 * Two ways to get a ribbon on something that is not the dev server:
 * - build({ entryPoints: { "./main.html": { ribbon } } }): the ribbon is inside
 *   the build directory, so it must be a build made for a preview
 * - startBuildServer({ ribbon }): the ribbon exists only in the response, the
 *   build directory stays exactly as it was written
 */

import { build, startBuildServer } from "@jsenv/core";
import { assert } from "@jsenv/assert";
import { readFileSync, writeFileSync } from "@jsenv/filesystem";
import { chromium } from "playwright";

let debug = false;
const buildDirectoryUrl = import.meta.resolve("./git_ignored/build/");
const snapshotsDirectoryUrl = import.meta.resolve("./snapshots/");

const buildWithRibbon = async (ribbon) => {
  await build({
    logs: { level: "warn" },
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl,
    entryPoints: {
      "./main.html": {
        bundling: false,
        minification: false,
        versioning: false,
        ribbon,
      },
    },
  });
  return String(readFileSync(new URL("./main.html", buildDirectoryUrl)));
};

const browser = await chromium.launch({ headless: !debug, devtools: debug });
const page = await browser.newPage({ ignoreHTTPSErrors: true });
await page.setViewportSize({ width: 800, height: 400 });
const takeScreenshot = async (scenario) => {
  const screenshotBuffer = await page.screenshot();
  writeFileSync(
    new URL(`./${scenario}.png`, snapshotsDirectoryUrl),
    screenshotBuffer,
  );
};
const openBuildServerPage = async ({ ribbon }) => {
  const buildServer = await startBuildServer({
    logLevel: "off",
    serverLogLevel: "off",
    buildDirectoryUrl,
    keepProcessAlive: false,
    port: 0,
    ribbon,
  });
  await page.goto(`${buildServer.origin}/main.html`);
  await page.locator("#jsenv_ribbon_text").waitFor();
  return buildServer;
};

try {
  // ribbon injected at build time
  {
    const buildHtml = await buildWithRibbon({
      text: "preview",
      color: "#7c3aed",
      href: "https://github.com/org/repo/pull/42",
    });
    const buildServer = await openBuildServerPage({ ribbon: false });
    await takeScreenshot("0_ribbon_in_build");
    const actual = buildHtml.includes("injectRibbon");
    const expect = true;
    assert({ actual, expect });
    buildServer.stop();
  }

  // ribbon injected by the server, build directory untouched
  {
    const buildHtml = await buildWithRibbon(false);
    const buildServer = await openBuildServerPage({
      ribbon: {
        text: "preview",
        color: "#7c3aed",
        href: "https://github.com/org/repo/pull/42",
        position: "top",
      },
    });
    await takeScreenshot("1_ribbon_in_build_server");
    const actual = buildHtml.includes("injectRibbon");
    const expect = false;
    assert({ actual, expect });
    buildServer.stop();
  }
} finally {
  if (!debug) {
    browser.close();
  }
}
