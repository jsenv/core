import { chromium, firefox, webkit } from "playwright";
import { ensureEmptyDirectory, writeFileSync } from "@jsenv/filesystem";
import { createTaskLog } from "@jsenv/log";
import { takeDirectorySnapshot } from "@jsenv/snapshot";

if (process.platform === "win32") {
  // disable on windows because it would fails due to line endings (CRLF)
  process.exit(0);
}

process.env.GENERATING_SNAPSHOTS = "true";
const { devServer } = await import("./start_dev_server.mjs");
const snapshotDirectoryUrl = new URL(`./snapshots/`, import.meta.url);
const screenshotsDirectoryUrl = new URL(`./sceenshots/`, import.meta.url);

const test = async ({ browserLauncher, browserName }) => {
  const browser = await browserLauncher.launch({ headless: true });

  const generateHtmlForStory = async ({ story }) => {
    const task = createTaskLog(`snapshoting ${story} on ${browserName}`, {
      disabled: process.env.CI,
    });
    const page = await browser.newPage();
    try {
      await page.goto(`${devServer.origin}/${story}/main.html`);
    } catch (e) {
      throw new Error(
        `error while loading page on ${browserName} for ${story}: ${e.stack}`,
      );
    }
    try {
      await page.waitForSelector("jsenv-error-overlay", { timeout: 5_000 });
    } catch (e) {
      throw new Error(
        `jsenv error overlay not displayed on ${browserName} for ${story}`,
      );
    }
    // wait a bit more to let client time to fetch error details from server
    await new Promise((resolve) => setTimeout(resolve, 200));

    const htmlGenerated = await page.evaluate(
      /* eslint-disable no-undef */
      async () => {
        const outerHtml = document
          .querySelector("jsenv-error-overlay")
          .shadowRoot.querySelector(".overlay").outerHTML;
        return outerHtml
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, `"`)
          .replace(/&#039;/g, `'`);
      },
      /* eslint-enable no-undef */
    );
    if (!process.env.CI) {
      await page.setViewportSize({ width: 900, height: 550 }); // generate smaller screenshots
      const sceenshotBuffer = await page
        .locator("jsenv-error-overlay")
        .screenshot();
      writeFileSync(
        new URL(`./${story}_${browserName}.png`, screenshotsDirectoryUrl),
        sceenshotBuffer,
      );
    }
    writeFileSync(
      new URL(`./${story}_${browserName}.html`, snapshotDirectoryUrl),
      process.platform === "win32"
        ? htmlGenerated.replace(/\r\n/g, "\n")
        : htmlGenerated,
    );
    await page.close();
    task.done();
  };

  try {
    await generateHtmlForStory({
      story: "js_classic_inline_throw",
    });
    await generateHtmlForStory({
      story: "js_classic_throw",
    });
    await generateHtmlForStory({
      story: "js_module_export_not_found",
    });
    await generateHtmlForStory({
      story: "js_module_import_not_found",
    });
    await generateHtmlForStory({
      story: "js_module_inline_export_not_found",
    });
    await generateHtmlForStory({
      story: "js_module_inline_import_not_found",
    });
    await generateHtmlForStory({
      story: "js_module_inline_assertion_error",
    });
    await generateHtmlForStory({
      story: "js_module_inline_syntax_error",
    });
    await generateHtmlForStory({
      story: "js_module_inline_throw",
    });
    await generateHtmlForStory({
      story: "js_module_plugin_error_transform",
    });
    await generateHtmlForStory({
      story: "js_module_syntax_error",
    });
    await generateHtmlForStory({
      story: "js_module_throw",
    });
    // for some reason webkit ignore this error (it does not report an error on window)
    if (browserLauncher !== webkit) {
      await generateHtmlForStory({
        story: "js_module_top_level_await_then_throw",
      });
    }
    await generateHtmlForStory({
      story: "js_module_unhandled_rejection",
    });
    // the column number is flaky on CI for this specific story + webkit
    if (browserLauncher !== webkit) {
      await generateHtmlForStory({
        story: "js_module_undefined_is_not_a_function",
      });
    }
    await generateHtmlForStory({
      story: "js_module_worker_throw",
    });
    await generateHtmlForStory({
      story: "script_src_not_found",
    });
  } finally {
    browser.close();
  }
};

try {
  const directorySnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  if (!process.env.CI) {
    await ensureEmptyDirectory(screenshotsDirectoryUrl);
  }
  await ensureEmptyDirectory(snapshotDirectoryUrl);
  await test({ browserLauncher: chromium, browserName: "chromium" });
  await test({ browserLauncher: firefox, browserName: "firefox" });
  await test({ browserLauncher: webkit, browserName: "webkit" });
  directorySnapshot.compare();
} finally {
  devServer.stop();
}
