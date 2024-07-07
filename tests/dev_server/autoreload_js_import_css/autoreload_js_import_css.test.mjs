import { readFileSync, writeFileSync } from "node:fs";
import { chromium, firefox } from "playwright";
import { assert } from "@jsenv/assert";
import { writeFileStructureSync } from "@jsenv/filesystem";

import { startDevServer } from "@jsenv/core";

const test = async ({
  debug = false,
  browserLauncher,
  browserName,
  pageLogsAfterUpdatingCssFile = [
    {
      type: "startGroupCollapsed",
      text:
        browserName === "chromium"
          ? "[jsenv] hot reloading file.js (style.css modified)"
          : "[jsenv] hot reloading file.js (style.css modified)",
    },
    {
      type: "log",
      text: "call dispose callback",
    },
    {
      type: "log",
      text: "remove stylesheet",
    },
    {
      type: "log",
      text: "importing js module",
    },
    {
      type: "log",
      text: "adding stylesheet",
    },
    {
      type: "log",
      text: "js module import done",
    },
    {
      type: "endGroup",
      text: "",
    },
  ],
  pageLogsAfterRemovingCssImport = [
    {
      type: "startGroupCollapsed",
      text: "[jsenv] hot reloading main.js (main.js modified)",
    },
    {
      type: "log",
      text: "importing js module",
    },
    {
      type: "log",
      text: "js module import done",
    },
    {
      type: "endGroup",
      text: "",
    },
    {
      type: "startGroupCollapsed",
      text: "[jsenv] cleanup file.js (no longer referenced by main.js)",
    },
    {
      type: "log",
      text: "call dispose callback",
    },
    {
      type: "log",
      text: "remove stylesheet",
    },
    {
      type: "endGroup",
      text: "",
    },
  ],
  pageLogsAfterRestoringCssImport = [
    {
      type: "startGroupCollapsed",
      text: "[jsenv] hot reloading main.js (main.js modified)",
    },
    {
      type: "log",
      text: "importing js module",
    },
    {
      type: "log",
      text: "adding stylesheet",
    },
    {
      type: "log",
      text: "js module import done",
    },
    {
      type: "endGroup",
      text: "",
    },
  ],
  ...rest
}) => {
  const sourceDirectoryUrl = new URL("./git_ignored/", import.meta.url);
  const jsFileUrl = new URL("./main.js", sourceDirectoryUrl);
  const cssFileUrl = new URL("./style.css", sourceDirectoryUrl);
  writeFileStructureSync(
    sourceDirectoryUrl,
    new URL("./0_at_start/", import.meta.url),
  );
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

    {
      const actual = {
        bodyBackgroundColor: await getDocumentBodyBackgroundColor(),
        pageLogs,
      };
      expectedPageLogs.push({
        type: "log",
        text: "adding stylesheet",
      });
      const expect = {
        bodyBackgroundColor: "rgb(255, 0, 0)", // red
        pageLogs: expectedPageLogs,
      };
      assert({ actual, expect });
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    writeFileSync(
      cssFileUrl,
      readFileSync(
        new URL("./1_fixtures/style_background_green.css", import.meta.url),
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    {
      const actual = {
        bodyBackgroundColor: await getDocumentBodyBackgroundColor(),
        pageLogs,
      };
      expectedPageLogs.push(...pageLogsAfterUpdatingCssFile);
      const expect = {
        bodyBackgroundColor: "rgb(0, 128, 0)", // green
        pageLogs: expectedPageLogs,
      };
      assert({ actual, expect });
    }
    // remove usage of the css file
    writeFileSync(
      jsFileUrl,
      readFileSync(
        new URL("./1_fixtures/main_comment_file_import.js", import.meta.url),
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    {
      const actual = {
        bodyBackgroundColor: await getDocumentBodyBackgroundColor(),
        pageLogs,
      };
      expectedPageLogs.push(...pageLogsAfterRemovingCssImport);
      const expect = {
        bodyBackgroundColor: "rgba(0, 0, 0, 0)",
        pageLogs: expectedPageLogs,
      };
      assert({
        actual,
        expect,
        details: {
          browser: browserName,
        },
      });
    }
    // restore deps on css file
    writeFileSync(
      jsFileUrl,
      readFileSync(new URL("./0_at_start/main.js", import.meta.url)),
    );
    // wait for partial reload effect to be done
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    {
      const actual = {
        bodyBackgroundColor: await getDocumentBodyBackgroundColor(),
        pageLogs,
      };
      expectedPageLogs.push(...pageLogsAfterRestoringCssImport);
      const expect = {
        bodyBackgroundColor: "rgb(0, 128, 0)", // green
        pageLogs: expectedPageLogs,
      };
      assert({
        actual,
        expect,
        details: {
          browswer: browserName,
        },
      });
    }
  } finally {
    if (!debug) {
      browser.close();
    }
    if (!debug) {
      await devServer.stop();
    }
  }
};

if (
  // TODO: fix on windows
  process.platform !== "win32" &&
  // TODO: fix on linux
  process.platform !== "linux"
) {
  await test({
    browserLauncher: chromium,
    browserName: "chromium",
  });
  await test({
    browserLauncher: firefox,
    browserName: "firefox",
  });
}
