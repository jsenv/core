/*
 * A command deferred behind its control's own action must still know what it
 * aims at. `<Button command="--navi-close" action={send}>` inside a popup: the
 * close waits for the send, and the send's own re-render usually takes the
 * button away before it succeeds. Resolved at that point, the close walked the
 * DOM around a detached button, found no expandable, and was dropped with a
 * warning — the popup stayed open over a request that went through, and (with
 * mount="while-opened") re-rendered on the fresh data as if asked a second
 * time.
 *
 * Both cases below press the same button; only the action differs in whether
 * it replaces it.
 */

import { startDevServer } from "@jsenv/core";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";
import { snapshotTests } from "@jsenv/snapshot";
import { chromium } from "playwright";

const devServer = await startDevServer({
  logLevel: "off",
  serverLogLevel: "off",
  sourceDirectoryUrl: import.meta.resolve("../../"),
  keepProcessAlive: false,
  clientAutoreload: false,
  http2: false,
  port: 0,
  plugins: [jsenvPluginPreact()],
});
const pageUrl = `${devServer.origin}/tests/deferred_command_target/client/deferred_command_target.html`;

const browser = await chromium.launch({ headless: true });

// The action settles in 200ms and the popup animates out; leave room so what is
// read is the state the press ends on, not one on the way there.
const settle = (page) => page.waitForTimeout(600);

const pressAndRead = async (page, id) => {
  const warnings = [];
  const onConsole = (message) => {
    if (message.type() === "warning") {
      warnings.push(message.text());
    }
  };
  page.on("console", onConsole);
  try {
    await page.click(`#open_${id}`);
    await settle(page);
    const openedBefore = await page.getAttribute(`#${id}`, "aria-expanded");
    await page.click(`#confirm_${id}`);
    // Read while the action is still running: whether its own re-render has
    // already taken the pressed button away is the only difference between the
    // two cases, and it is the state a late-resolved command would have had to
    // find its target in.
    const buttonPresentWhileActionRuns = await page.evaluate((confirmId) => {
      /* eslint-disable no-undef */
      return Boolean(document.querySelector(`#${confirmId}`));
      /* eslint-enable no-undef */
    }, `confirm_${id}`);
    await settle(page);
    return {
      opened_before_press: openedBefore,
      button_present_while_action_runs: buttonPresentWhileActionRuns,
      // "false" is the whole point: the press closed the popup it was made in.
      opened_after_press: await page.getAttribute(`#${id}`, "aria-expanded"),
      warnings,
    };
  } finally {
    page.off("console", onConsole);
  }
};

const openPage = async () => {
  const page = await browser.newPage();
  await page.goto(pageUrl);
  await settle(page);
  // The dev server covers the viewport when the workspace it serves has drifted
  // (a dependency installed at a version package.json does not ask for). It is
  // about the checkout, not about this page, and it swallows every press.
  await page.evaluate(() => {
    /* eslint-disable no-undef */
    document.querySelector("jsenv-warning-overlay")?.remove();
    /* eslint-enable no-undef */
  });
  return page;
};

// The dev server fills its own cache directory while cooking the page; those
// hundreds of files are not what this test is about.
snapshotTests.prefConfigure({
  filesystemActions: {
    "**/.jsenv/": "ignore",
  },
});

try {
  await snapshotTests(import.meta.url, ({ test }) => {
    test("close deferred behind an action that replaces its button", async () => {
      const page = await openPage();
      try {
        return await pressAndRead(page, "replaced");
      } finally {
        await page.close();
      }
    });

    test("close deferred behind an action that leaves its button", async () => {
      const page = await openPage();
      try {
        return await pressAndRead(page, "kept");
      } finally {
        await page.close();
      }
    });
  });
} finally {
  await browser.close();
  devServer.stop();
}
