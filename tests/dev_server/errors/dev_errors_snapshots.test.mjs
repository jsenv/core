import { writeFileSync } from "@jsenv/filesystem";
import { snapshotTests } from "@jsenv/snapshot";
import { chromium, firefox, webkit } from "playwright";

if (process.platform === "win32") {
  // disable on windows because it would fails due to line endings (CRLF)
  process.exit(0);
}

process.env.GENERATING_SNAPSHOTS = "true"; // for dev server
const { devServer } = await import("./start_dev_server.mjs");
const run = async ({ browserLauncher, browserName }) => {
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
    } catch {
      throw new Error(
        `jsenv error overlay not displayed on ${browserName} for ${story}`,
      );
    }
    // wait a bit more to let client time to fetch error details from server
    await new Promise((resolve) => setTimeout(resolve, 200));
    await takePageSnapshots(page, `${story}_${browserName}`);
    await page.close();
    // if (!process.env.CI && !process.env.JSENV) {
    //   console.log(`"${story}" snapshot generated for ${browserName}`);
    // }
  };
  const takePageSnapshots = async (page, scenario) => {
    await page.setViewportSize({ width: 900, height: 550 }); // generate smaller screenshots
    const htmlGenerated = await page.evaluate(
      /* eslint-disable no-undef */
      async () => {
        const outerHtml = document
          .querySelector("jsenv-error-overlay")
          .shadowRoot.querySelector(".overlay").outerHTML;
        return outerHtml;
      },
      /* eslint-enable no-undef */
    );
    writeFileSync(
      new URL(`./output/html/${scenario}.html`, import.meta.url),
      htmlGenerated,
    );
    const sceenshotBuffer = await page
      .locator("jsenv-error-overlay")
      .screenshot();
    writeFileSync(
      new URL(`./output/screenshots/${scenario}.png`, import.meta.url),
      sceenshotBuffer,
    );
  };
  for (const story of [
    "js_classic_inline_throw",
    "js_classic_throw",
    "js_module_export_not_found",
    "js_module_import_bare_specifier",
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
    "js_module_top_level_await_then_throw",
    "js_module_unhandled_rejection",
    "js_module_undefined_is_not_a_function",
    "js_module_worker_throw",
    "script_src_not_found",
    "script_src_not_found_and_preact",
    // "script_type_importmap_not_found", // for now there is no error overlay in that case
    "script_type_module_src_not_found",
  ]) {
    await takeSnapshotsForStory(story);
  }
  await browser.close();
};
snapshotTests.prefConfigure({
  filesystemActions: {
    "**/.jsenv/": "ignore",
    "**/*.png": "compare_presence_only",
  },
});
await snapshotTests(import.meta.url, ({ test }) => {
  test("0_chromium", () =>
    run({
      browserLauncher: chromium,
      browserName: "chromium",
    }));

  test("1_firefox", () =>
    run({
      browserLauncher: firefox,
      browserName: "firefox",
    }));

  test("2_webkit", () =>
    run({
      browserLauncher: webkit,
      browserName: "webkit",
    }));
});

await devServer.stop();
