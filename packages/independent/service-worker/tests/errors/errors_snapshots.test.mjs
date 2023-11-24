/*
 * when there is an error during install/activate
 * the service worker is still registered and cannot be unregistered by API
 * test that is we rebuild a correct service worker (one that does not throw)
 * the registration happens somehow and everything works fine
 * test this also when the update fails to install/activate
 */

import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { takeDirectorySnapshot, compareSnapshots } from "@jsenv/snapshot";
import { fetchUrl } from "@jsenv/fetch";
import { ensureEmptyDirectory } from "@jsenv/filesystem";
import { createTaskLog } from "@jsenv/log";

import { buildServer } from "./errors_build_server.mjs";

if (process.env.CI) {
  // https certificate not trusted on CI, see https://github.com/jsenv/https-local/issues/9
  process.exit(0);
}

const snapshotDirectoryUrl = new URL("./snapshots/html/", import.meta.url);
const debug = false;
const test = async () => {
  const browser = await chromium.launch({
    headless: !debug,
    // needed because https-localhost fails to trust cert on chrome + linux (ubuntu 20.04)
    args: ["--ignore-certificate-errors"],
  });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const htmlUrl = `${buildServer.origin}/main.html`;
    const page = await context.newPage();
    await page.setViewportSize({ width: 640, height: 480 }); // set a relatively small and predicatble size
    page.on("console", (message) => {
      if (message.type() === "error") {
        console.error(message.text());
      }
    });
    await page.goto(htmlUrl);

    const buildStory = async (name) => {
      await fetchUrl(`${buildServer.origin}/build_${name}`, {
        ignoreHttpsError: true,
      });
    };
    const clickToCheckUpdate = async (page) => {
      const updateCheckButton = await page.locator(
        "button#update_check_button",
      );
      await updateCheckButton.click();
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    };
    const waitForPageReady = async (page) => {
      const pageReadyPromise = page.evaluate(
        /* eslint-disable no-undef */
        () => window.readyPromise,
        /* eslint-enable no-undef */
      );
      await pageReadyPromise;
    };
    let snapshotCount = 0;
    const takeSnapshots = async (page, name) => {
      name = `${snapshotCount}_${name}`;
      snapshotCount++;
      const task = createTaskLog(`snapshoting "${name}" on chromium`, {
        disabled: process.env.CI,
      });
      const uiLocator = await page.locator("#ui");
      if (!process.env.CI) {
        const uiScreenshotBuffer = await uiLocator.screenshot();
        writeFileSync(
          new URL(`./snapshots/screen/${name}.png`, import.meta.url),
          uiScreenshotBuffer,
        );
      }
      const uiHtml = await page.evaluate(
        /* eslint-disable no-undef */
        async () => {
          return document
            .querySelector("#ui")
            .outerHTML.replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, `"`)
            .replace(/&#039;/g, `'`);
        },
        /* eslint-enable no-undef */
      );
      writeFileSync(
        new URL(`./snapshots/html/${name}.html`, import.meta.url),
        uiHtml,
      );
      task.done();
    };

    await waitForPageReady(page);
    await takeSnapshots(page, "after_load");

    // error during first register
    await buildStory("error_during_register");
    {
      const registerButton = await page.locator("button#register");
      await registerButton.click();
      // let time for browser to fetch/parse/execute
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    await takeSnapshots(page, "error_during_register");
    await page.reload();
    await waitForPageReady(page);

    // register a version without error
    await buildStory("no_error");
    {
      const registerButton = await page.locator("button#register");
      await registerButton.click();
    }
    // try to update no_error -> error_during_register
    await buildStory("error_during_register");
    await clickToCheckUpdate(page);
    await takeSnapshots(page, "error_during_register_found");
  } finally {
    browser.close();
  }
};

try {
  const expectedSnapshots = takeDirectorySnapshot(snapshotDirectoryUrl);
  await ensureEmptyDirectory(snapshotDirectoryUrl);
  await test();
  const actualSnapshots = takeDirectorySnapshot(snapshotDirectoryUrl);
  compareSnapshots(actualSnapshots, expectedSnapshots);
} finally {
  if (!debug) {
    buildServer.stop();
  }
}
