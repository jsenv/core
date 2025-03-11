import { assert } from "@jsenv/assert";

import { setupTest } from "@jsenv/pwa/tests/setup_test.mjs";

// https certificate only generated on linux
if (process.platform === "linux") {
  const debug = false;
  const { testServer, page, browser } = await setupTest({
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    debug,
  });
  try {
    await page.goto(`${testServer.origin}/main.html`);
    const actual = await page.evaluate(
      /* eslint-disable no-undef */
      () => window.resultPromise,
      /* eslint-enable no-undef */
    );
    const expect = "pong";
    assert({ actual, expect });
  } finally {
    if (!debug) {
      browser.close();
    }
  }
}
