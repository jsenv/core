import { assert } from "@jsenv/assert";
import { startDevServer } from "@jsenv/core";
import { replaceFileStructureSync } from "@jsenv/filesystem";
import { readFileSync, writeFileSync } from "node:fs";
import { chromium, firefox } from "playwright";

if (process.platform === "win32") {
  // TODO: fix on windows
  process.exit(0);
}
if (process.platform === "linux") {
  // TODO: fix on linux
  process.exit(0);
}

const test = async ({
  debug = false,
  browserLauncher,
  browserName,
  pageLogsAfterUpdatingCssFile = [
    {
      type: "log",
      text:
        browserName === "chromium"
          ? "[jsenv] hot reload file.js (style.css modified)"
          : "[jsenv] hot reload file.js (style.css modified)",
    },
    {
      type: "log",
      text: "remove stylesheet",
    },
    {
      type: "log",
      text: "adding stylesheet",
    },
  ],
  pageLogsAfterRemovingCssImport = [
    {
      type: "log",
      text: "[jsenv] hot reload main.js (main.js modified)",
    },
    {
      type: "log",
      text: "[jsenv] cleanup file.js (no longer referenced by main.js)",
    },
    {
      type: "log",
      text: "remove stylesheet",
    },
  ],
  pageLogsAfterRestoringCssImport = [
    {
      type: "log",
      text: "[jsenv] hot reload main.js (main.js modified)",
    },
    {
      type: "log",
      text: "adding stylesheet",
    },
  ],
  ...rest
}) => {
  const sourceDirectoryUrl = new URL("./git_ignored/", import.meta.url);
  const jsFileUrl = new URL("./main.js", sourceDirectoryUrl);
  const cssFileUrl = new URL("./style.css", sourceDirectoryUrl);
  replaceFileStructureSync({
    from: new URL("./fixtures/0_at_start/", import.meta.url),
    to: sourceDirectoryUrl,
  });
  const devServer = await startDevServer({
    logLevel: "warn",
    sourceDirectoryUrl,
    keepProcessAlive: false,
    clientAutoreload: {
      cooldownBetweenFileEvents: 250,
      clientServerEventsConfig: {
        logs: false,
      },
    },
    port: 0,
    ...rest,
  });
  const browser = await browserLauncher.launch({ headless: !debug });
  try {
    const pageLogs = [];
    const expectedPageLogs = [];
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    page.on("console", (message) => {
      const type = message.type();
      const text = message.text();
      pageLogs.push({
        type,
        text: type === "endGroup" ? "" : text,
      });
    });
    await page.goto(`${devServer.origin}/main.html`);
    await page.evaluate(
      /* eslint-disable no-undef */
      () => window.readyPromise,
      /* eslint-enable no-undef */
    );
    const getDocumentBodyBackgroundColor = () => {
      return page.evaluate(
        /* eslint-disable no-undef */
        () => window.getComputedStyle(document.body).backgroundColor,
        /* eslint-enable no-undef */
      );
    };
    const assertBodyColorAndLogs = async (expectBodyBackgroundColor) => {
      const actual = {
        bodyBackgroundColor: await getDocumentBodyBackgroundColor(),
        pageLogs,
        browserName,
      };
      const expect = {
        bodyBackgroundColor: expectBodyBackgroundColor,
        pageLogs: expectedPageLogs,
        browserName,
      };
      assert({
        actual,
        expect,
      });
    };
    expectedPageLogs.push({
      type: "log",
      text: "adding stylesheet",
    });
    await assertBodyColorAndLogs(
      "rgb(255, 0, 0)", // red
    );
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    writeFileSync(
      cssFileUrl,
      readFileSync(
        new URL(
          "./fixtures/1_other/style_background_green.css",
          import.meta.url,
        ),
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    expectedPageLogs.push(...pageLogsAfterUpdatingCssFile);
    await assertBodyColorAndLogs("rgb(0, 128, 0)");
    // remove usage of the css file
    writeFileSync(
      jsFileUrl,
      readFileSync(
        new URL(
          "./fixtures/1_other/main_comment_file_import.js",
          import.meta.url,
        ),
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    expectedPageLogs.push(...pageLogsAfterRemovingCssImport);
    await assertBodyColorAndLogs("rgba(0, 0, 0, 0)");
    // restore deps on css file
    writeFileSync(
      jsFileUrl,
      readFileSync(new URL("./fixtures/0_at_start/main.js", import.meta.url)),
    );
    // wait for partial reload effect to be done
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    expectedPageLogs.push(...pageLogsAfterRestoringCssImport);
    await assertBodyColorAndLogs(
      "rgb(0, 128, 0)", // green
    );
  } finally {
    if (!debug) {
      browser.close();
    }
    if (!debug) {
      await devServer.stop();
    }
  }
};

await test({
  browserLauncher: chromium,
  browserName: "chromium",
});
await test({
  browserLauncher: firefox,
  browserName: "firefox",
});
