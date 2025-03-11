import { fetchUrl } from "@jsenv/fetch";
import { ensureEmptyDirectory, writeFileSync } from "@jsenv/filesystem";
import { createTaskLog } from "@jsenv/humanize";
import { takeDirectorySnapshot } from "@jsenv/snapshot";
import { chromium } from "playwright";

if (process.env.CI) {
  // https certificate not trusted on CI, see https://github.com/jsenv/https-local/issues/9
  process.exit(0);
}

const { buildServer } = await import("./update_build_server.mjs");
const snapshotDirectoryUrl = new URL("./snapshots/html/", import.meta.url);
const screenshotDirectoryUrl = new URL("./snapshots/screen/", import.meta.url);
const debug = false;
const test = async () => {
  const browser = await chromium.launch({
    headless: !debug, // needed because https-localhost fails to trust cert on chrome + linux (ubuntu 20.04)
    args: ["--ignore-certificate-errors"],
  });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const openPage = async (url) => {
      const page = await context.newPage();
      await page.setViewportSize({ width: 640, height: 480 }); // set a relatively small and predicatble size
      page.on("console", (message) => {
        if (message.type() === "error") {
          console.error(message.text());
        }
      });
      page.on("pageerror", (error) => {
        throw error;
      });
      await page.goto(url);
      return page;
    };
    const buildStory = async (animalName) => {
      await fetchUrl(`${buildServer.origin}/update_animal_to_${animalName}`, {
        ignoreHttpsError: true,
      });
    };
    const clickToCheckUpdate = async (page) => {
      const updateCheckButton = await page.locator(
        "button#update_check_button",
      );
      await updateCheckButton.click();
      // wait a bit so that service worker is "installed" (and not installing)
      await new Promise((resolve) => setTimeout(resolve, 500));
    };
    let snapshotCount = 0;
    const takeSnapshots = async ([pageA, pageB], name) => {
      name = `${snapshotCount}_${name}`;
      snapshotCount++;
      const task = createTaskLog(`snapshoting "${name}" on chromium`, {
        disabled: process.env.CI || process.env.JSENV,
      });
      await takeSnapshot(pageA, `a/${name}`);
      await takeSnapshot(pageB, `b/${name}`);
      task.done();
    };
    const takeSnapshot = async (page, name) => {
      const uiLocator = await page.locator("#ui");
      if (!process.env.CI) {
        const uiScreenshotBuffer = await uiLocator.screenshot();
        writeFileSync(
          new URL(`${name}.png`, screenshotDirectoryUrl),
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
            .replace(/&#039;/g, `'`)
            .replace(/src="blob:https.*?"/, `src="blob:replaced_for_snapshot"`);
        },
        /* eslint-enable no-undef */
      );
      writeFileSync(new URL(`${name}.html`, snapshotDirectoryUrl), uiHtml);
    };

    const htmlUrl = `${buildServer.origin}/main.html`;
    const pageA = await openPage(htmlUrl);
    const pageB = await openPage(htmlUrl);

    const waitForPagesReady = async () => {
      const pageAReadyPromise = pageA.evaluate(
        /* eslint-disable no-undef */
        () => window.readyPromise,
        /* eslint-enable no-undef */
      );
      const pageBReadyPromise = pageA.evaluate(
        /* eslint-disable no-undef */
        () => window.readyPromise,
        /* eslint-enable no-undef */
      );
      await Promise.all([pageAReadyPromise, pageBReadyPromise]);
    };
    const clickToHotReplace = async () => {
      const pageAUpdateNowButton = await pageA.locator("#update_now_button");
      await pageAUpdateNowButton.click();
      // wait a bit, corresponds to:
      // - time for service worker to switch from "installed" to "activated"
      //   (execution of "activate" event)
      // - time for service_worker_facade to hot replace (a fetch request to new url)
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    };

    await waitForPagesReady();
    await takeSnapshots([pageA, pageB], "after_load");
    const pageARegisterButton = await pageA.locator("button#register");
    await pageARegisterButton.click();
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    await takeSnapshots([pageA, pageB], "dog_after_register");
    await Promise.all([pageA.reload(), pageB.reload()]);
    await waitForPagesReady();
    await takeSnapshots([pageA, pageB], "dog_after_reload");

    await buildStory("cat");
    await clickToCheckUpdate(pageA);
    await takeSnapshots([pageA, pageB], "cat_found");
    const pageARestartButton = await pageA.locator(
      "button#update_by_restart_button",
    );
    const pageAReloadPromise = pageA.waitForNavigation();
    const pageBReloadPromise = pageB.waitForNavigation();
    await pageARestartButton.click();
    await pageAReloadPromise;
    await pageBReloadPromise;
    await waitForPagesReady();
    await takeSnapshots([pageA, pageB], "cat_after_reload");

    const pageAHotUpdateCheckbox = await pageA.locator(
      "input#image_hot_update",
    );
    await pageAHotUpdateCheckbox.click();
    const pageBHotUpdateCheckbox = await pageB.locator(
      "input#image_hot_update",
    );
    await pageBHotUpdateCheckbox.click();
    await buildStory("horse");
    await clickToCheckUpdate(pageA);
    await takeSnapshots([pageA, pageB], "horse_found");
    await clickToHotReplace(pageA);

    await takeSnapshots([pageA, pageB], "horse_after_hot_replace");
    await buildStory("bear");
    await clickToCheckUpdate(pageA);
    await takeSnapshots([pageA, pageB], "bear_found");
    await clickToHotReplace(pageA);
    await takeSnapshots([pageA, pageB], "bear_after_hot_replace");

    // ensure going back to horse is possible
    await buildStory("horse");
    await clickToCheckUpdate(pageA);
    await clickToHotReplace(pageA);
    await takeSnapshots([pageA, pageB], "back_to_horse");
  } finally {
    browser.close();
  }
};

try {
  const directorySnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  if (!process.env.CI) {
    await ensureEmptyDirectory(screenshotDirectoryUrl);
  }
  await test();
  directorySnapshot.compare();
} finally {
  if (!debug) {
    buildServer.stop();
  }
}
