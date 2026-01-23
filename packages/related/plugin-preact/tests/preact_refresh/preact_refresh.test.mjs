import { startDevServer } from "@jsenv/core";
import { snapshotDevTests } from "@jsenv/core/tests/snapshot_dev_tests.js";
import { replaceFileStructureSync, replaceFileSync } from "@jsenv/filesystem";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";
import { chromium } from "playwright";

if (process.platform === "linux") {
  process.exit(0);
}

replaceFileStructureSync({
  from: new URL("./fixtures/0_at_start/", import.meta.url),
  to: new URL("./git_ignored/", import.meta.url),
});

const run = async ({ browserLauncher }) => {
  const devServer = await startDevServer({
    sourceDirectoryUrl: new URL("./git_ignored/", import.meta.url),
    keepProcessAlive: false,
    port: 0,
    plugins: [
      jsenvPluginPreact({
        refreshInstrumentation: true,
      }),
    ],
    clientAutoreload: {
      cooldownBetweenFileEvents: 300,
    },
    sourcemaps: "none",
  });
  const browser = await browserLauncher.launch({ headless: true });
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

  const labelAtStart = await getCountLabelText();
  await increase();
  const labelAfterIncrease = await getCountLabelText();
  replaceFileSync({
    from: new URL("./fixtures/label_tata.js", import.meta.url),
    to: new URL("./git_ignored/label.js", import.meta.url),
  });
  await new Promise((resolve) => setTimeout(resolve, 600));
  const labelAfterUpdateTata = await getCountLabelText();
  await increase();
  const labelTataAfterIncrease = await getCountLabelText();
  await browser.close();
  return {
    labelAtStart,
    labelAfterIncrease,
    labelAfterUpdateTata,
    labelTataAfterIncrease,
  };
};

await snapshotDevTests(
  import.meta.url,
  ({ test }) => {
    test("0_chromium", () => run({ browserLauncher: chromium }));
  },
  {
    filesystemEffects: false,
  },
);
