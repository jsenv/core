import { startDevServer } from "@jsenv/core";
import { replaceFileStructureSync } from "@jsenv/filesystem";
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

let debug = true;
const sourceDirectoryUrl = new URL("./git_ignored/", import.meta.url);
const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);

const devServer = await startDevServer({
  logLevel: "off",
  serverLogLevel: "off",
  sourceDirectoryUrl,
  keepProcessAlive: !debug,
  port: 0,
});
const browser = await chromium.launch({
  headless: !debug,
  devtools: debug,
});
const page = await browser.newPage({ ignoreHTTPSErrors: true });
await page.setViewportSize({ width: 600, height: 300 }); // set a relatively small and predicatble size
const takeScreenshot = async (scenario) => {
  const sceenshotBuffer = await page.screenshot();
  writeFileSync(
    new URL(`./${scenario}.png`, snapshotsDirectoryUrl),
    sceenshotBuffer,
  );
};

try {
  replaceFileStructureSync({
    from: new URL("./fixtures/0_at_start/", import.meta.url),
    to: sourceDirectoryUrl,
  });
  await page.goto(`${devServer.origin}`);
  await takeScreenshot("0_root_one_file");
  replaceFileStructureSync({
    from: new URL("./fixtures/1_more_files/", import.meta.url),
    to: sourceDirectoryUrl,
  });
  await page.reload();
  await takeScreenshot("1_root_many_file");
  await page.goto(`${devServer.origin}/dir/`);
  await takeScreenshot("2_dir_many_file");
} finally {
  if (!debug) {
    browser.close();
    devServer.stop();
  }
}
