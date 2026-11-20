/*
 * A nav whose tabs are the pages of a row follows that row as it moves (the
 * bar between two tabs), and lets go when that row stops. Another row on the
 * same page — its pages none of the nav's tabs — moving or stopping is about
 * its own tabs: the nav goes on following its own row. It used to let go at
 * the first word from any row.
 */

"jsenv:allocate 60s";

import { snapshotTests } from "@jsenv/snapshot";

import {
  configureBrowserSnapshots,
  createEngineTests,
  openPage,
  startNaviDevServer,
} from "../browser_harness.mjs";

const devServer = await startNaviDevServer();
const pageUrl = `${devServer.origin}/tests/nav_follows_its_row/client/main.html`;

/* eslint-disable no-undef */
const step = (page, rowName, move) =>
  page.evaluate(
    ({ name, value }) => {
      window.moveRow(name, value);
      return window.readNav();
    },
    { name: rowName, value: move },
  );
/* eslint-enable no-undef */

configureBrowserSnapshots();
const { testInEngines, closeBrowsers } = createEngineTests();

try {
  await snapshotTests(import.meta.url, ({ test }) => {
    testInEngines(
      test,
      "another row moving and stopping while the nav follows its own",
      async ({ browser }) => {
        const { page, errors, warnings } = await openPage(browser, pageUrl);
        try {
          await page.waitForSelector("#tabs_nav .navi_link");
          return {
            tabs_row_moves: await step(page, "tabs", {
              base: "info",
              toward: "score",
              progress: 0.3,
            }),
            games_row_moves: await step(page, "games", {
              base: "game_a",
              toward: "game_b",
              progress: 0.5,
            }),
            games_row_stops: await step(page, "games", null),
            tabs_row_moves_on: await step(page, "tabs", {
              base: "info",
              toward: "score",
              progress: 0.6,
            }),
            tabs_row_stops: await step(page, "tabs", null),
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
