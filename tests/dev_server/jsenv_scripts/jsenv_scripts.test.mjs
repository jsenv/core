/*
 */

import { fileURLToPath } from "node:url";
import prettier from "prettier";
import { chromium } from "playwright";
import { writeFileSync } from "@jsenv/filesystem";
import { takeDirectorySnapshot } from "@jsenv/snapshot";

import { startDevServer } from "@jsenv/core";
import { readFileSync } from "node:fs";

const debug = false;
const devServer = await startDevServer({
  sourcemaps: "none",
  logLevel: "off",
  serverLogLevel: "off",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
  keepProcessAlive: false,
  port: 0,
});
const jsenvCoreDirectoryUrl = new URL("../../../", import.meta.url);
const jsenvCoreDirectoryPath = fileURLToPath(jsenvCoreDirectoryUrl);

const browser = await chromium.launch({ headless: !debug });
const page = await browser.newPage({ ignoreHTTPSErrors: true });

const writeDevServerOutputFile = async (relativeUrl) => {
  const runtimeId = Array.from(devServer.kitchenCache.keys())[0];
  const fileUrl = new URL(
    `./.jsenv/${runtimeId}/${relativeUrl}`,
    import.meta.url,
  );
  const fileContent = String(readFileSync(fileUrl));
  const fileWithUrlsMocked = fileContent.replaceAll(
    jsenvCoreDirectoryPath,
    "/mock/",
  );
  const fileContentFormatted = await prettier.format(fileWithUrlsMocked, {
    parser: relativeUrl.endsWith(".html") ? "html" : "babel",
  });
  writeFileSync(
    new URL(`./output/${relativeUrl}`, import.meta.url),
    fileContentFormatted,
  );
};

try {
  await page.goto(`${devServer.origin}/main.html`);
  const testOutputDirectorySnapshot = takeDirectorySnapshot(
    new URL("./output/", import.meta.url),
  );
  await writeDevServerOutputFile("./main.html");
  await writeDevServerOutputFile("./main.js");
  testOutputDirectorySnapshot.compare();
} finally {
  if (!debug) {
    browser.close();
    devServer.stop(); // required because for some reason the rooms are kept alive
  }
}
