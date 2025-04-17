import { startDevServer } from "@jsenv/core";
import {
  replaceFileStructureSync,
  writeDirectorySync,
  writeFileSync,
} from "@jsenv/filesystem";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";
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
  directoryListing: {
    urlMocks: true,
  },
  clientAutoreload: false,
  port: 0,
  plugins: [jsenvPluginPreact()],
});
const browser = await chromium.launch({
  headless: !debug,
  devtools: debug,
});
const page = await browser.newPage({ ignoreHTTPSErrors: true });
await page.setViewportSize({ width: 800, height: 500 }); // set a relatively small and predicatble size
const takeScreenshot = async (scenario) => {
  const sceenshotBuffer = await page.screenshot();
  writeFileSync(
    new URL(`./${scenario}.png`, snapshotsDirectoryUrl),
    sceenshotBuffer,
  );
};

try {
  await page.goto(`${devServer.origin}`);
  await takeScreenshot("0_root_one_file");
  replaceFileStructureSync({
    from: new URL("./fixtures/1_many_files/", import.meta.url),
    to: sourceDirectoryUrl,
  });
  await page.reload();
  await takeScreenshot("1_root_many_file");
  await page.goto(`${devServer.origin}/dir/`);
  await takeScreenshot("2_dir_many_file");
  await page.locator(`a[href="/dir/deep/"]`).click();
  await takeScreenshot("3_after_click_deep");
  await page.locator(`.nav a[href="/dir/"]`).click();
  await takeScreenshot("4_after_click_dir_in_nav");
  await page.locator(`.nav a[href="/..."]`).click();
  await takeScreenshot("5_after_click_root_in_nav");
  replaceFileStructureSync({
    from: new URL("./fixtures/2_index_exists/", import.meta.url),
    to: sourceDirectoryUrl,
  });
  await page.reload();
  await page.goto(`${devServer.origin}/...`);
  await takeScreenshot("6_index_exists");
  await page.goto(`${devServer.origin}/dir/...`);
  await takeScreenshot("7_index_exists_dir");
  await page.locator(`.nav a[href="/..."]`).click();
  await takeScreenshot("8_after_click_root_in_nav");
  await page.goto(`${devServer.origin}/dir/foo/bar/`);
  await takeScreenshot("9_dir_404");
  writeDirectorySync(new URL("./git_ignored/dir/empty/", import.meta.url));
  await page.goto(`${devServer.origin}/dir/empty/file.js`);
  await takeScreenshot("10_file_404_dir_empty");
} finally {
  if (!debug) {
    browser.close();
    devServer.stop();
  }
}
