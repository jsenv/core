import { writeFileSync } from "@jsenv/filesystem";
import { takeDirectorySnapshot } from "@jsenv/snapshot";
import { chromium, firefox, webkit } from "playwright";

if (process.platform === "win32") {
  // disable on windows because it would fails due to line endings (CRLF)
  process.exit(0);
}

process.env.GENERATING_SNAPSHOTS = "true"; // for dev sevrer
const { devServer } = await import("./start_dev_server.mjs");
const htmlOutputDirectoryUrl = new URL(`./output/html/`, import.meta.url);
const screenshotOutputDirectoryUrl = new URL(
  `./output/sceenshots/`,
  import.meta.url,
);
const takePageSnapshots = async (page, scenario) => {
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
  await page.setViewportSize({ width: 900, height: 550 }); // generate smaller screenshots
  const sceenshotBuffer = await page
    .locator("jsenv-error-overlay")
    .screenshot();
  writeFileSync(
    new URL(`./${scenario}.png`, screenshotOutputDirectoryUrl),
    sceenshotBuffer,
  );
  writeFileSync(
    new URL(`./${scenario}.html`, htmlOutputDirectoryUrl),
    process.platform === "win32"
      ? htmlGenerated.replace(/\r\n/g, "\n")
      : htmlGenerated,
  );
};

const test = async ({ browserLauncher, browserName }) => {
  const browserHtmlFilesSnapshot = takeDirectorySnapshot(
    htmlOutputDirectoryUrl,
    {
      [`**/**_${browserName}.*`]: true,
    },
  );
  const browserPngFilesSnapshot = takeDirectorySnapshot(
    screenshotOutputDirectoryUrl,
    {
      [`**/**_${browserName}.*`]: process.platform === "darwin",
    },
  );
  const browser = await browserLauncher.launch({ headless: true });
  const takeSnapshotsForStory = async (story) => {
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
    await takePageSnapshots(page, `${story}_${browserName}`);

    await page.close();
    if (!process.env.CI && !process.env.JSENV) {
      console.log(`"${story}" snapshot generated for ${browserName}`);
    }
  };

  try {
    for (const story of [
      "js_classic_inline_throw",
      "js_classic_throw",
      "js_module_export_not_found",
      "js_module_import_not_found",
      "js_module_inline_export_not_found",
      "js_module_inline_import_not_found",
      "js_module_inline_assertion_error",
      "js_module_inline_syntax_error",
      "js_module_inline_syntax_error_unexpected_end",
      "js_module_inline_throw",
      "js_module_plugin_error_transform",
      "js_module_syntax_error",
      "js_module_syntax_error_unexpected_end",
      "js_module_throw",
      // for some reason webkit ignore this error (it does not report an error on window)
      ...(browserLauncher === webkit
        ? []
        : ["js_module_top_level_await_then_throw"]),
      "js_module_unhandled_rejection",
      // the column number is flaky on CI for this specific story + webkit
      ...(browserLauncher === webkit
        ? []
        : ["js_module_undefined_is_not_a_function"]),
      "js_module_worker_throw",
      "script_src_not_found",
    ]) {
      await takeSnapshotsForStory(story);
    }
  } finally {
    browser.close();
  }
  browserHtmlFilesSnapshot.compare();
  browserPngFilesSnapshot.compare();
};

try {
  await Promise.all([
    test({ browserLauncher: chromium, browserName: "chromium" }),
    test({ browserLauncher: firefox, browserName: "firefox" }),
    test({ browserLauncher: webkit, browserName: "webkit" }),
  ]);
} finally {
  devServer.stop();
}
