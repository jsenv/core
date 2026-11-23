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

"jsenv:allocate 90s";

import { snapshotTests } from "@jsenv/snapshot";

import {
  configureBrowserSnapshots,
  createEngineTests,
  openPage as openHarnessPage,
  startNaviDevServer,
} from "../browser_harness.mjs";

const devServer = await startNaviDevServer();
const pageUrl = `${devServer.origin}/tests/deferred_command_target/client/deferred_command_target.html`;

// Waited for, the time it takes: the popup opening, the action settling (200ms)
// and the popup closing. The bound is what a state that never comes costs.
const waitForExpanded = (page, id, expanded) =>
  page
    .waitForFunction(
      ({ selector, value }) =>
        // eslint-disable-next-line no-undef
        document.querySelector(selector)?.getAttribute("aria-expanded") ===
        value,
      { selector: `#${id}`, value: String(expanded) },
      { timeout: 3000 },
    )
    .catch(() => {});

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
    await waitForExpanded(page, id, true);
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
    await waitForExpanded(page, id, false);
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

const openPage = async (browser) => {
  const { page } = await openHarnessPage(browser, pageUrl);
  await page.waitForSelector("#open_replaced", { timeout: 0 });
  return page;
};

configureBrowserSnapshots();
const { testInEngines, closeBrowsers } = createEngineTests();

try {
  await snapshotTests(import.meta.url, ({ test }) => {
    testInEngines(
      test,
      "close deferred behind an action that replaces its button",
      async ({ browser }) => {
        const page = await openPage(browser);
        try {
          return await pressAndRead(page, "replaced");
        } finally {
          await page.close();
        }
      },
    );

    testInEngines(
      test,
      "close deferred behind an action that leaves its button",
      async ({ browser }) => {
        const page = await openPage(browser);
        try {
          return await pressAndRead(page, "kept");
        } finally {
          await page.close();
        }
      },
    );
  });
} finally {
  await closeBrowsers();
  devServer.stop();
}
