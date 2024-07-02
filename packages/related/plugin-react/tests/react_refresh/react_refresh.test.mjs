import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { assert } from "@jsenv/assert";

import { startDevServer } from "@jsenv/core";
import { jsenvPluginReact } from "@jsenv/plugin-react";

const test = async () => {
  const countLabelClientFileUrl = new URL(
    "./client/count_label.jsx",
    import.meta.url,
  );

  const devServer = await startDevServer({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: false,
    plugins: [jsenvPluginReact({ refreshInstrumentation: true })],
    clientAutoreload: {
      cooldownBetweenFileEvents: 150,
    },
    port: 0,
  });
  const browser = await chromium.launch({
    headless: true,
  });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
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
      countLabelClientFileUrl,
      readFileSync(new URL("./fixtures/count_label_1.jsx", import.meta.url)),
    );
    await new Promise((resolve) => setTimeout(resolve, 1_000));
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
      countLabelClientFileUrl,
      readFileSync(new URL("./fixtures/count_label_0.jsx", import.meta.url)),
    );
  }
};

if (process.platform !== "win32") {
  await test();
}
