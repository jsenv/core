/*
 * A push writes the crossing it played on the entry it created only when a
 * traversal could not find it again on its own: that write is a second history
 * write per push, and browsers count them (Safari refuses past 100 in 10
 * seconds). What each case pins:
 * - the default and a relation written for this very way: one write, nothing
 *   recorded, and the back and the forward still play the way round they
 *   should;
 * - a movement the link asked for, and a page reached from anywhere: recorded
 *   (two writes), since the back could not deduce it — and it plays it back.
 */

"jsenv:allocate 60s";

import { snapshotTests } from "@jsenv/snapshot";

import {
  configureBrowserSnapshots,
  createEngineTests,
  openPage,
  startNaviDevServer,
  whenPageAtRest,
} from "../browser_harness.mjs";

const devServer = await startNaviDevServer();
const pageUrl = `${devServer.origin}/tests/route_transition_crossing/client/route_transition_crossing.html`;

const readSince = async (page, mark) => {
  const read = await page.evaluate(() => {
    /* eslint-disable no-undef */
    return {
      history_writes: window.historyWrites,
      crossing_recorded: window.history.state?.jsenv_route_transition ?? null,
      movements: window.movements.slice(),
    };
    /* eslint-enable no-undef */
  });
  await page.evaluate(() => {
    /* eslint-disable no-undef */
    window.historyWrites = 0;
    window.movements = [];
    /* eslint-enable no-undef */
  });
  return { [mark]: read };
};

configureBrowserSnapshots();
const { testInEngines, closeBrowsers } = createEngineTests();

try {
  await snapshotTests(import.meta.url, ({ test }) => {
    for (const source of ["default", "written", "request", "anywhere"]) {
      testInEngines(
        test,
        `push, back, forward (${source})`,
        async ({ browser }) => {
          const { page, errors, warnings } = await openPage(
            browser,
            `${pageUrl}?source=${source}`,
          );
          try {
            await whenPageAtRest(page);
            await readSince(page, "load");
            await page.click("#to_detail");
            await page.waitForSelector("#detail_page");
            await whenPageAtRest(page);
            const push = await readSince(page, "push");
            await page.evaluate(() => window.history.back()); // eslint-disable-line no-undef
            await page.waitForSelector("#home_page");
            await whenPageAtRest(page);
            const back = await readSince(page, "back");
            await page.evaluate(() => window.history.forward()); // eslint-disable-line no-undef
            await page.waitForSelector("#detail_page");
            await whenPageAtRest(page);
            const forward = await readSince(page, "forward");
            return { ...push, ...back, ...forward, errors, warnings };
          } finally {
            await page.close();
          }
        },
      );
    }
  });
} finally {
  await closeBrowsers();
  devServer.stop();
}
