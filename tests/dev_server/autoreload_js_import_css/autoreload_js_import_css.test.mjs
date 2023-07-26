import { readFileSync, writeFileSync } from "node:fs";
import { chromium, firefox } from "playwright";
import { assert } from "@jsenv/assert";

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
  const jsFileUrl = new URL("./client/main.js", import.meta.url);
  const jsFileContent = {
    beforeTest: readFileSync(jsFileUrl),
    update: (content) => writeFileSync(jsFileUrl, content),
    restore: () => writeFileSync(jsFileUrl, jsFileContent.beforeTest),
  };
  const cssFileUrl = new URL("./client/style.css", import.meta.url);
  const cssFileContent = {
    beforeTest: readFileSync(cssFileUrl),
    update: (content) => writeFileSync(cssFileUrl, content),
    restore: () => writeFileSync(cssFileUrl, cssFileContent.beforeTest),
  };

  const devServer = await startDevServer({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: false,
    clientAutoreload: {
      cooldownBetweenFileEvents: 250,
      clientServerEventsConfig: {
        logs: false,
      },
    },
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
      const expected = {
        bodyBackgroundColor: "rgb(255, 0, 0)", // red
        pageLogs: expectedPageLogs,
      };
      assert({ actual, expected });
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    cssFileContent.update(`body { background: green; }`);
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    {
      const actual = {
        bodyBackgroundColor: await getDocumentBodyBackgroundColor(),
        pageLogs,
      };
      expectedPageLogs.push(...pageLogsAfterUpdatingCssFile);
      const expected = {
        bodyBackgroundColor: "rgb(0, 128, 0)", // green
        pageLogs: expectedPageLogs,
      };
      assert({ actual, expected });
    }
    // remove usage of the css file
    jsFileContent.update(`
// import "./file.js";

if (import.meta.hot) {
  import.meta.hot.accept();
}`);
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    {
      const actual = {
        bodyBackgroundColor: await getDocumentBodyBackgroundColor(),
        pageLogs,
      };
      expectedPageLogs.push(...pageLogsAfterRemovingCssImport);
      const expected = {
        bodyBackgroundColor: "rgba(0, 0, 0, 0)",
        pageLogs: expectedPageLogs,
      };
      assert({ actual, expected, context: browserName });
    }
    // restore deps on css file
    jsFileContent.update(`
import "./file.js";

if (import.meta.hot) {
  import.meta.hot.accept();
}`);
    // wait for partial reload effect to be done
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    {
      const actual = {
        bodyBackgroundColor: await getDocumentBodyBackgroundColor(),
        pageLogs,
      };
      expectedPageLogs.push(...pageLogsAfterRestoringCssImport);
      const expected = {
        bodyBackgroundColor: "rgb(0, 128, 0)", // green
        pageLogs: expectedPageLogs,
      };
      assert({ actual, expected, context: browserName });
    }
  } finally {
    if (!debug) {
      browser.close();
    }
    jsFileContent.restore();
    cssFileContent.restore();
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
