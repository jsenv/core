/*
 * The goal of this file is to:
 * - See the effect of using jsenv dev server on source files
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import prettier from "prettier";
import { chromium } from "playwright";
import { writeFileSync, ensureEmptyDirectory } from "@jsenv/filesystem";

import { startDevServer } from "@jsenv/core";
// import { jsenvPluginToolbar } from "@jsenv/plugin-toolbar";
import { launchBrowserPage } from "../../launch_browser_page.js";

const debug = false;
await ensureEmptyDirectory(new URL("./.jsenv/", import.meta.url));
const devServer = await startDevServer({
  sourcemaps: "none",
  logLevel: "off",
  serverLogLevel: "off",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
  keepProcessAlive: false,
  port: 0,
  // plugins: [jsenvPluginToolbar()],
  clientAutoreload: true,
  ribbon: false,
});
const jsenvCoreDirectoryUrl = new URL("../../../", import.meta.url);
const jsenvCoreDirectoryPath = fileURLToPath(jsenvCoreDirectoryUrl);

const browser = await chromium.launch({ headless: !debug });
const page = await launchBrowserPage(browser, { pageErrorEffect: "log" });

const writeDevServerOutputFile = async (relativeUrl) => {
  const runtimeId = Array.from(devServer.kitchenCache.keys())[0];
  const fileUrl = new URL(
    `./.jsenv/${runtimeId}/${relativeUrl}`,
    import.meta.url,
  );
  const fileContent = String(readFileSync(fileUrl));
  const fileContentFormatted = await normalizeFileContent(fileContent, fileUrl);
  writeFileSync(
    new URL(`./output/${relativeUrl}`, import.meta.url),
    fileContentFormatted,
  );
};
const normalizeFileContent = async (fileContent, fileUrl) => {
  fileContent = fileContent.replaceAll(jsenvCoreDirectoryPath, "/mock/");
  fileContent = fileContent.replaceAll(
    `${devServer.origin}`,
    "http://localhost",
  );
  fileContent = await prettier.format(fileContent, {
    parser: String(fileUrl).endsWith(".html") ? "html" : "babel",
  });
  return fileContent;
};

try {
  await page.goto(`${devServer.origin}/main.html`);
  await writeDevServerOutputFile("./main.html");
  await writeDevServerOutputFile("./main.js");
  const html = await page.content();
  const htmlFileUrl = new URL(
    `./output/main_after_execution.html`,
    import.meta.url,
  );
  const htmlNormalized = await normalizeFileContent(html, htmlFileUrl);
  writeFileSync(htmlFileUrl, htmlNormalized);
} finally {
  if (!debug) {
    browser.close();
    devServer.stop(); // required because for some reason the rooms are kept alive
  }
}
