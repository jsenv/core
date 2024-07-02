import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { assert } from "@jsenv/assert";
import { startDevServer } from "@jsenv/core";
import { launchBrowserPage } from "@jsenv/core/tests/launch_browser_page.js";

import { jsenvPluginPreact } from "@jsenv/plugin-preact";

const labelClientFileUrl = new URL("./client/label.js", import.meta.url);

const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  plugins: [
    jsenvPluginPreact({
      refreshInstrumentation: true,
    }),
  ],
  clientAutoreload: {
    cooldownBetweenFileEvents: 250,
  },
  port: 0,
});
const browser = await chromium.launch({
  headless: true,
});
try {
  const page = await launchBrowserPage(browser);
  await page.goto(`${devServer.origin}/main.html`);
  await page.evaluate(
    /* eslint-disable no-undef */
    () => window.readyPromise,
    /* eslint-enable no-undef */
  );
  const getCountLabelText = () => {
    return page.evaluate(
      /* eslint-disable no-undef */
      () => document.querySelector("#count_label").innerHTML,
      /* eslint-enable no-undef */
    );
  };
  const increase = () => {
    return page.click("#button_increase");
  };

  {
    const actual = {
      countLabelText: await getCountLabelText(),
    };
    const expect = {
      countLabelText: "toto: 0",
    };
    assert({ actual, expect });
  }

  {
    await increase();
    const actual = {
      countLabelText: await getCountLabelText(),
    };
    const expect = {
      countLabelText: "toto: 1",
    };
    assert({ actual, expect });
  }
  writeFileSync(
    labelClientFileUrl,
    readFileSync(new URL("./fixtures/label_1.js", import.meta.url)),
  );
  await new Promise((resolve) => setTimeout(resolve, 500));
  {
    const actual = {
      countLabelText: await getCountLabelText(),
    };
    const expect = {
      countLabelText: "tata: 1",
    };
    assert({ actual, expect });
  }
  {
    await increase();
    const actual = {
      countLabelText: await getCountLabelText(),
    };
    const expect = {
      countLabelText: "tata: 2",
    };
    assert({ actual, expect });
  }
} finally {
  browser.close();
  writeFileSync(
    labelClientFileUrl,
    readFileSync(new URL("./fixtures/label_0.js", import.meta.url)),
  );
}
