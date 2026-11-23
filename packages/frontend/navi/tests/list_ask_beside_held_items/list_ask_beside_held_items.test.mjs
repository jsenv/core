/*
 * What a list reading by range asks for when its window stands a few rows
 * short of the rows it holds — where a fling leaves it, its pages behind. The
 * page grows away from the rows held and stops right before them: none of
 * them is asked for again. Centred on the window, as when nothing is held
 * anywhere near, it asked again for up to a third of a page (2v2's thread:
 * ~235 rows re-asked over six flings, on one run in two).
 */

"jsenv:allocate 90s";

import { snapshotTests } from "@jsenv/snapshot";

import {
  configureBrowserSnapshots,
  createEngineTests,
  openPage,
  startNaviDevServer,
  whenPageAtRest,
} from "../browser_harness.mjs";

const devServer = await startNaviDevServer();
const pageUrl = `${devServer.origin}/tests/list_ask_beside_held_items/client/main.html`;

const jumpAndWaitRow = async (page, row) => {
  await page.evaluate((target) => window.jumpTo(target), row); // eslint-disable-line no-undef
  await page.waitForFunction(
    (target) =>
      // eslint-disable-next-line no-undef
      [...document.querySelectorAll("[navi-list-item-real]")].some(
        (rowEl) => rowEl.textContent === `row ${target}`,
      ),
    row,
  );
};

const readAsked = async (page) => {
  const requests = await page.evaluate(() => window.requests); // eslint-disable-line no-undef
  const asked = new Set();
  let rowsReAsked = 0;
  for (const { start, end } of requests) {
    let row = start;
    while (row <= end) {
      if (asked.has(row)) {
        rowsReAsked++;
      } else {
        asked.add(row);
      }
      row++;
    }
  }
  return {
    asked: requests.map(({ start, end }) => `${start}-${end}`),
    rows_re_asked: rowsReAsked,
  };
};

configureBrowserSnapshots();
const { testInEngines, closeBrowsers } = createEngineTests();

try {
  await snapshotTests(import.meta.url, ({ test }) => {
    testInEngines(
      test,
      "window standing short of the rows held, twice",
      async ({ browser }) => {
        const { page, errors, warnings } = await openPage(browser, pageUrl, {
          viewport: { width: 390, height: 844 },
        });
        try {
          await whenPageAtRest(page);
          await page.waitForFunction(
            () => window.requests.length > 0, // eslint-disable-line no-undef
          );
          await jumpAndWaitRow(page, 2200);
          const opened = await readAsked(page);
          await jumpAndWaitRow(page, 2096);
          const firstJump = await readAsked(page);
          await jumpAndWaitRow(page, 1996);
          const secondJump = await readAsked(page);
          return {
            opened,
            first_jump: firstJump,
            second_jump: secondJump,
            errors,
            warnings,
          };
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
