import { assert } from "@jsenv/assert";
import { readFileSync, writeFileSync } from "node:fs";

import { setupTest } from "@jsenv/pwa/tests/setup_test.mjs";

const debug = false;
const { testServer, page, browser } = await setupTest({
  rootDirectoryUrl: import.meta.resolve("./client/"),
  debug,
});
const swFileUrl = new URL("./client/sw.js", import.meta.url);
const swFileContent = {
  beforeTest: readFileSync(swFileUrl),
  update: (content) => writeFileSync(swFileUrl, content),
  restore: () => writeFileSync(swFileUrl, swFileContent.beforeTest),
};

try {
  const pageLogs = [];
  page.on("console", (message) => {
    pageLogs.push({ type: message.type(), text: message.text() });
  });
  await page.setViewportSize({ width: 400, height: 200 }); // set a relatively small and predicatble size
  await page.goto(`${testServer.origin}/main.html`);
  await page.waitForSelector("#service_worker_ui", { timeout: 5_000 });

  const takeServiceWorkerUIScreenshot = async ({ name }) => {
    const sceenshotBuffer = await page
      .locator("#service_worker_ui")
      .screenshot();
    writeFileSync(
      new URL(`./screenshots/${name}`, import.meta.url),
      sceenshotBuffer,
    );
  };

  await takeServiceWorkerUIScreenshot({ name: "0_before_register.png" });
  const registerButton = await page.locator("#register");
  await registerButton.click();
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  // now take screenshots + ensure browser logs
  await takeServiceWorkerUIScreenshot({ name: "1_after_register.png" });
  assert({
    actual: pageLogs,
    expect: [],
  });
} finally {
  if (!debug) {
    browser.close();
  }
}
