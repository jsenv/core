"jsenv:allocate 45s";

/*
 * A `<List.Items>` run reads its collection at the COLLECTION's ranks, not at
 * the list's row numbers.
 *
 * Reported from an application: a group page declaring the admin's row before
 * a run reading the members by range drew four rows for three members — the
 * first member missing, a skeleton that never resolved at the end, and a
 * second ask for a range past the collection. One declared row shifted the
 * whole run by one, two would shift it by two.
 *
 * The same list is mounted three times here with nothing but the number of
 * declared rows changing. What it holds: the rows drawn and the ranges asked
 * for are the same in all three, because the collection is the same in all
 * three — where the run sits in the list is the list's business.
 */

import { snapshotTests } from "@jsenv/snapshot";

import {
  configureBrowserSnapshots,
  createEngineTests,
  startNaviDevServer,
} from "../browser_harness.mjs";

const devServer = await startNaviDevServer();
configureBrowserSnapshots();
const { testInEngines, closeBrowsers } = createEngineTests();

const readLists = async (browser) => {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    // The run's budget ("jsenv:allocate") is the limit: under a full test run
    // the first load, which cooks all of navi, outlasts Playwright's 30s —
    // and so does the first render that follows it.
    await page.goto(
      `${devServer.origin}/tests/list_run_after_declared_rows/client/main.html`,
      { timeout: 0 },
    );
    await page.waitForSelector("#alone li", { timeout: 0 });
    // A second ask, when there is one, goes out on the render that follows the
    // first answer: long enough after it that "not yet" and "never" cannot be
    // read as the same thing. A list says nothing when its asks are settled,
    // so this one wait is a time.
    await page.waitForTimeout(500);
    const read = async (listId) => ({
      rows_drawn: await page
        .locator(`#${listId} li`)
        .allInnerTexts()
        .then((texts) => texts.map((text) => text.trim()).join(" | ")),
      asked: await page.evaluate(
        (id) => window.asks[id].join(", "), // eslint-disable-line no-undef
        listId,
      ),
    });
    return {
      no_declared_row: await read("alone"),
      one_declared_row: await read("one_declared"),
      two_declared_rows: await read("two_declared"),
      errors,
    };
  } finally {
    await page.close();
  }
};

try {
  await snapshotTests(import.meta.url, ({ test }) => {
    testInEngines(
      test,
      "a run alone, after one declared row, after two",
      async ({ browser }) => readLists(browser),
    );
  });
} finally {
  await closeBrowsers();
  devServer.stop();
}
