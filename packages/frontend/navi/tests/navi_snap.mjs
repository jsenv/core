import { writeFileSync } from "@jsenv/filesystem";
import { snapshotTests } from "@jsenv/snapshot";
import { urlToFilename } from "@jsenv/urls";
import { chromium, firefox } from "playwright";

if (process.platform === "win32") {
  // disable on windows because it would fails due to line endings (CRLF)
  process.exit(0);
}

process.env.GENERATING_SNAPSHOTS = "true"; // for dev server
const { devServer } = await import("./dev_server.mjs");
const run = async ({ browserLauncher, browserName }) => {
  const browser = await browserLauncher.launch({ headless: true });
  const takeSnapshotsForStory = async (story) => {
    const page = await browser.newPage();
    const serverUrl = `${devServer.origin}/${story}`;
    try {
      await page.goto(serverUrl);
    } catch (e) {
      throw new Error(
        `error while loading page on ${browserName} for ${story}: ${e.stack}`,
      );
    }
    const filename = urlToFilename(serverUrl);
    // console.log(`taking snapshot of: ${story} on ${browserName}`);
    // await new Promise((resolve) => setTimeout(resolve, 200));
    await takePageSnapshots(page, `${filename}_${browserName}`);
    await page.close();
  };
  const takePageSnapshots = async (page, scenario) => {
    await page.setViewportSize({ width: 900, height: 600 }); // generate smaller screenshots
    const sceenshotBuffer = await page.screenshot({ fullPage: true });
    writeFileSync(
      import.meta.resolve(`./output/${scenario}.png`),
      sceenshotBuffer,
    );
  };
  for (const story of [
    "src/components/layout/demos/demo_flex.html",
    "src/components/layout/demos/demo_layout_buttons.html",
    "src/components/text/demos/demo_badge_count.html",
    "src/components/text/demos/demo_message_box.html",
    "src/components/text/demos/demo_icon.html",
    "src/components/text/demos/demo_text_spacing.html",
    "src/components/text/demos/demo_text_overflow.html",
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
try {
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
  });
} finally {
  await devServer.stop();
}
